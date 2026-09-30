import { api, ApiClientError } from "@/lib/api-client";
import { AuthCodeInputSchema, type AuthAttemptView } from "@/lib/ai-auth-flow";
import type { WebAuthProvider } from "@/lib/ai-auth";
import { localizedApiError } from "@/lib/i18n/api-error";
import type { Locale } from "@/lib/i18n/locale";
import { AI_COPY, type AuthCodeErrorKey, type AuthErrorKey } from "./ai-copy";

export type AuthRequest = <T>(path: string, init: RequestInit & { json?: unknown }) => Promise<T>;
export type AuthTimers = {
  /** The callback returns the poll's settlement, which lets tests await it deterministically. */
  readonly set: (callback: () => Promise<void>, ms: number) => number;
  readonly clear: (handle: number) => void;
};

type AuthScope = {
  readonly setupToken?: string;
};

/**
 * A sign-in problem kept as a reason plus the failed request, never as rendered text, so
 * the panel re-renders it in the current language without rebuilding the controller.
 */
export type AuthPanelError = { readonly key: AuthErrorKey; readonly cause?: unknown };

export type AuthPanelSnapshot = {
  readonly attempt: AuthAttemptView | null;
  readonly starting: boolean;
  readonly submitting: boolean;
  /** Google authorization code typed by the user; lives only in memory and is cleared once used or abandoned. */
  readonly code: string;
  readonly codeError: AuthCodeErrorKey | null;
  readonly error: AuthPanelError | null;
};

const IDLE: AuthPanelSnapshot = { attempt: null, starting: false, submitting: false, code: "", codeError: null, error: null };
const browserTimers: AuthTimers = {
  set: (callback, ms) => window.setTimeout(() => void callback(), ms),
  clear: (handle) => window.clearTimeout(handle),
};

function scopeBody(setupToken: string | undefined): { setupToken?: string } {
  return setupToken ? { setupToken: setupToken.trim() } : {};
}

/** A failed request keeps its error so the server's localized explanation, if any, can be shown. */
function failure(key: AuthErrorKey, cause: unknown): AuthPanelError {
  return { key, cause };
}

/** Render a retained sign-in problem in `locale`. */
export function authPanelErrorText(error: AuthPanelError, locale: Locale): string {
  const fallback = AI_COPY[locale].auth.errors[error.key];
  return "cause" in error ? localizedApiError(error.cause, locale, fallback) : fallback;
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

export function attemptError(status: AuthAttemptView["status"], provider?: WebAuthProvider): AuthPanelError | null {
  switch (status) {
    case "denied":
      return { key: "denied" };
    case "expired":
      return { key: "expired" };
    case "failed":
      return { key: provider === "google" ? "googleFailed" : "failed" };
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
      this.update({ error: { key: "needSetupToken" } });
      return;
    }
    const generation = this.generation;
    const previous = this.snapshot.attempt;
    this.stopPolling();
    this.update({ ...IDLE, starting: true });
    this.onReadyChange(undefined);
    // Once the previous attempt is gone server-side it must never come back: restarting from it would loop on not_found.
    let previousGone = false;
    try {
      if (previous) {
        await abandonAuthAttempt(previous.id, { setupToken }, this.request).catch((cause: unknown) => {
          // Already cancelled, finished or purged after expiry: nothing is left to abandon.
          if (!(cause instanceof ApiClientError && cause.code === "not_found")) throw cause;
        });
        previousGone = true;
      }
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
      // Only an attempt that may still exist stays visible, so the next start retries its cleanup.
      if (previous && !previousGone) this.show({ ...previous, status: "failed" });
      this.update({ error: failure("startFailed", cause) });
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
      this.update({ error: failure("cancelFailed", cause) });
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
      this.update({ codeError: "missing" });
      return;
    }
    if (!AuthCodeInputSchema.shape.code.safeParse(code).success) {
      this.update({ codeError: "format" });
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
      this.show(next, { code: "", submitting: false, codeError: awaitingAuthCode(next) ? "rejected" : null });
    } catch (cause) {
      if (!this.owns(generation, attempt.id)) return;
      // Transport or request failure: keep the pasted code so the user can resend or check status.
      this.update({ submitting: false, error: failure("codeSendFailed", cause) });
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
      this.show(next, rejected ? { codeError: "rejected" } : {});
    } catch (cause) {
      if (this.pollAbort !== controller) return;
      this.pollAbort = null;
      this.update({ error: failure("statusFailed", cause) });
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
