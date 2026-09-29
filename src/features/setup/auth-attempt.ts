import { api } from "@/lib/api-client";
import { AuthCodeInputSchema, type AuthAttemptView } from "@/lib/ai-auth-flow";
import type { WebAuthProvider } from "@/lib/ai-auth";

export type AuthRequest = <T>(path: string, init: RequestInit & { json?: unknown }) => Promise<T>;
export type AuthTimers = {
  /** The callback returns the poll's settlement, which lets tests await it deterministically. */
  readonly set: (callback: () => Promise<void>, ms: number) => number;
  readonly clear: (handle: number) => void;
};

type AuthScope = {
  readonly setupToken?: string;
};

export type AuthPanelSnapshot = {
  readonly attempt: AuthAttemptView | null;
  readonly starting: boolean;
  readonly submitting: boolean;
  /** Google authorization code typed by the user; lives only in memory and is cleared once used or abandoned. */
  readonly code: string;
  readonly codeError: string | null;
  readonly error: string | null;
};

const IDLE: AuthPanelSnapshot = { attempt: null, starting: false, submitting: false, code: "", codeError: null, error: null };
const CODE_REJECTED = "인증 코드를 확인하지 못했어요. Google 로그인 페이지에서 새 코드를 받아 붙여 넣어 주세요.";
const browserTimers: AuthTimers = {
  set: (callback, ms) => window.setTimeout(() => void callback(), ms),
  clear: (handle) => window.clearTimeout(handle),
};

function scopeBody(setupToken: string | undefined): { setupToken?: string } {
  return setupToken ? { setupToken: setupToken.trim() } : {};
}

function failure(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback;
}

export async function abandonAuthAttempt(id: string, scope: AuthScope, request: AuthRequest = api): Promise<void> {
  await request<{ ok: true }>(`/api/ai/auth/${id}`, { method: "DELETE", json: scopeBody(scope.setupToken) });
}

export function isActiveAttempt(attempt: AuthAttemptView | null): attempt is AuthAttemptView {
  return attempt?.status === "starting" || attempt?.status === "pending";
}

/** Google waits for a pasted authorization code; polling before that cannot change anything. */
export function awaitingAuthCode(attempt: AuthAttemptView | null): boolean {
  return attempt?.status === "pending" && attempt.requiresCode === true;
}

export function attemptError(status: AuthAttemptView["status"], provider?: WebAuthProvider): string | null {
  switch (status) {
    case "denied":
      return "로그인이 거부됐어요. 다시 시작해 주세요.";
    case "expired":
      return "로그인 시간이 만료됐어요. 다시 시작해 주세요.";
    case "failed":
      return provider === "google"
        ? "인증 코드를 확인하지 못했어요. 로그인 시작을 눌러 새 코드를 받아 주세요."
        : "로그인을 완료하지 못했어요. 다시 시도해 주세요.";
    case "starting":
    case "pending":
    case "ready":
      return null;
  }
}

/**
 * One provider/scope's login attempt. Every response is checked against the
 * current generation and attempt, so a reply that lands after cancellation or a
 * scope change never reaches the form.
 */
export class AuthAttemptController {
  private snapshot: AuthPanelSnapshot = IDLE;
  private readonly listeners = new Set<() => void>();
  private generation = 0;
  private pollTimer: number | null = null;
  private pollAbort: AbortController | null = null;
  private onReadyChange: (attemptId?: string) => void = () => {};
  private readonly request: AuthRequest;
  private readonly timers: AuthTimers;

  constructor(private readonly options: {
    readonly provider: WebAuthProvider;
    readonly enterpriseDomain?: string;
    readonly setupToken?: string;
    readonly request?: AuthRequest;
    readonly timers?: AuthTimers;
  }) {
    this.request = options.request ?? api;
    this.timers = options.timers ?? browserTimers;
  }

  getSnapshot = (): AuthPanelSnapshot => this.snapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Receives the ready attempt id, or undefined when a previous ready login stops applying. */
  setReadyHandler = (handler: (attemptId?: string) => void): void => {
    this.onReadyChange = handler;
  };

  setCode = (code: string): void => this.update({ code, codeError: null });

  start = async (): Promise<void> => {
    const { provider, enterpriseDomain, setupToken } = this.options;
    if (setupToken !== undefined && setupToken.trim().length < 32) {
      this.update({ error: "먼저 32자 이상의 설치 확인 코드를 입력해 주세요." });
      return;
    }
    const generation = this.generation;
    const previous = this.snapshot.attempt;
    this.stopPolling();
    this.update({ ...IDLE, starting: true });
    this.onReadyChange(undefined);
    try {
      if (previous) await abandonAuthAttempt(previous.id, { setupToken }, this.request);
      if (generation !== this.generation) return;
      const next = await this.request<AuthAttemptView>("/api/ai/auth", {
        method: "POST",
        json: {
          provider,
          ...(enterpriseDomain?.trim() ? { enterpriseDomain: enterpriseDomain.trim() } : {}),
          ...scopeBody(setupToken),
        },
      });
      if (generation !== this.generation) {
        await abandonAuthAttempt(next.id, { setupToken }, this.request);
        return;
      }
      this.show(next);
    } catch (cause) {
      if (generation !== this.generation) return;
      if (previous) this.show({ ...previous, status: "failed" });
      this.update({ error: failure(cause, "로그인을 시작하지 못했어요.") });
    } finally {
      if (generation === this.generation) this.update({ starting: false });
    }
  };

  cancel = async (): Promise<void> => {
    const attempt = this.snapshot.attempt;
    if (!attempt) return;
    this.generation += 1;
    this.stopPolling();
    this.reset();
    this.onReadyChange(undefined);
    try {
      await abandonAuthAttempt(attempt.id, this.options, this.request);
    } catch (cause) {
      this.update({ error: failure(cause, "로그인 시도를 취소하지 못했어요.") });
    }
  };

  /** Explicit status check after a failure; also allowed while Google awaits a code, to learn whether a lost submission arrived. */
  retryStatus = (): void => {
    const attempt = this.snapshot.attempt;
    if (!isActiveAttempt(attempt) || this.snapshot.submitting) return;
    this.update({ error: null });
    this.schedulePoll(attempt, true);
  };

  submitCode = async (): Promise<void> => {
    const attempt = this.snapshot.attempt;
    if (!attempt || !awaitingAuthCode(attempt) || this.snapshot.submitting) return;
    const code = this.snapshot.code.trim();
    if (!code) {
      this.update({ codeError: "Google 인증 코드를 붙여 넣어 주세요." });
      return;
    }
    if (!AuthCodeInputSchema.shape.code.safeParse(code).success) {
      this.update({ codeError: "Google 페이지에 표시된 인증 코드만 붙여 넣어 주세요. 주소(URL)나 공백은 넣지 않아요." });
      return;
    }
    const generation = this.generation;
    this.stopPolling();
    this.update({ submitting: true, codeError: null, error: null });
    try {
      const next = await this.request<AuthAttemptView>(`/api/ai/auth/${attempt.id}/code`, {
        method: "POST",
        json: { code, ...scopeBody(this.options.setupToken) },
      });
      if (!this.owns(generation, attempt.id)) return;
      // The server has decided on this code either way; a rejected code must be replaced, not resent.
      this.show(next, { code: "", submitting: false, codeError: awaitingAuthCode(next) ? CODE_REJECTED : null });
    } catch (cause) {
      if (!this.owns(generation, attempt.id)) return;
      // Transport or request failure: keep the pasted code so the user can resend or check status.
      this.update({ submitting: false, error: failure(cause, "인증 코드를 보내지 못했어요. 다시 시도해 주세요.") });
    }
  };

  /** Scope change, unmount or hidden Activity: abandon unfinished work and forget in-memory input. */
  release = (): void => {
    this.generation += 1;
    this.stopPolling();
    const current = this.snapshot.attempt;
    if (isActiveAttempt(current)) {
      void abandonAuthAttempt(current.id, this.options, this.request)
        .catch(() => console.warn("Provider login cleanup failed; the attempt will expire."));
    }
    this.reset();
  };

  private owns(generation: number, attemptId: string): boolean {
    return generation === this.generation && this.snapshot.attempt?.id === attemptId;
  }

  private show(attempt: AuthAttemptView, extra: Partial<AuthPanelSnapshot> = {}): void {
    // Once the server no longer needs a code, any retained copy has been used or is moot.
    this.update({ attempt, error: attemptError(attempt.status, this.options.provider), ...(awaitingAuthCode(attempt) ? {} : { code: "" }), ...extra });
    this.schedulePoll(attempt);
    if (attempt.status === "ready") this.onReadyChange(attempt.id);
  }

  private schedulePoll(attempt: AuthAttemptView, explicit = false): void {
    this.stopPolling();
    if (!isActiveAttempt(attempt) || (!explicit && awaitingAuthCode(attempt))) return;
    this.pollTimer = this.timers.set(() => {
      this.pollTimer = null;
      return this.poll(attempt);
    }, attempt.retryAfterMs ?? 5_000);
  }

  private async poll(attempt: AuthAttemptView): Promise<void> {
    const controller = new AbortController();
    this.pollAbort = controller;
    try {
      const next = await this.request<AuthAttemptView>(`/api/ai/auth/${attempt.id}`, {
        method: "POST",
        json: scopeBody(this.options.setupToken),
        signal: controller.signal,
      });
      if (this.pollAbort !== controller) return;
      this.pollAbort = null;
      const rejected = attempt.requiresCode === false && awaitingAuthCode(next);
      this.show(next, rejected ? { codeError: CODE_REJECTED } : {});
    } catch (cause) {
      if (this.pollAbort !== controller) return;
      this.pollAbort = null;
      this.update({ error: failure(cause, "로그인 상태를 확인하지 못했어요.") });
    }
  }

  private stopPolling(): void {
    if (this.pollTimer !== null) this.timers.clear(this.pollTimer);
    this.pollTimer = null;
    this.pollAbort?.abort();
    this.pollAbort = null;
  }

  private reset(): void {
    if (this.snapshot === IDLE) return;
    this.snapshot = IDLE;
    this.emit();
  }

  private update(patch: Partial<AuthPanelSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
