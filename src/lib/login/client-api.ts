export type LoginApiResult =
  | { kind: "success" }
  | { kind: "invalid_password" }
  | { kind: "locked"; retryAfterSeconds: number; message?: string }
  | { kind: "misconfigured" }
  | { kind: "network" };

type LoginJsonBody = {
  code?: string;
  error?: string;
  retryAfterSec?: number;
  retryAfterSeconds?: number;
  unlockAt?: number | string;
  message?: string;
};

const DEFAULT_LOCK_SECONDS = 60;

function parseUnlockAtSeconds(unlockAt: number | string, nowMs: number): number | null {
  if (typeof unlockAt === "number" && Number.isFinite(unlockAt)) {
    const asMs = unlockAt > 1e12 ? unlockAt : unlockAt * 1000;
    return Math.max(0, Math.ceil((asMs - nowMs) / 1000));
  }
  if (typeof unlockAt === "string") {
    const parsed = Date.parse(unlockAt);
    if (!Number.isNaN(parsed)) {
      return Math.max(0, Math.ceil((parsed - nowMs) / 1000));
    }
  }
  return null;
}

function lockedRetrySeconds(body: LoginJsonBody, nowMs: number): number {
  if (typeof body.retryAfterSec === "number" && body.retryAfterSec > 0) {
    return Math.ceil(body.retryAfterSec);
  }
  if (typeof body.retryAfterSeconds === "number" && body.retryAfterSeconds > 0) {
    return Math.ceil(body.retryAfterSeconds);
  }
  if (body.unlockAt !== undefined) {
    const fromUnlock = parseUnlockAtSeconds(body.unlockAt, nowMs);
    if (fromUnlock !== null && fromUnlock > 0) {
      return fromUnlock;
    }
  }
  return DEFAULT_LOCK_SECONDS;
}

function lockedResult(
  body: LoginJsonBody | null,
  nowMs: number,
): { kind: "locked"; retryAfterSeconds: number; message?: string } {
  return {
    kind: "locked",
    retryAfterSeconds: lockedRetrySeconds(body ?? {}, nowMs),
    message:
      typeof body?.message === "string" && body.message.length > 0
        ? body.message
        : undefined,
  };
}

function resolveOutcomeCode(body: LoginJsonBody | null): string | null {
  if (!body) return null;
  if (typeof body.code === "string" && body.code.length > 0) {
    return body.code;
  }
  if (typeof body.error === "string" && body.error.length > 0) {
    return body.error;
  }
  return null;
}

export function mapLoginJsonResponse(
  status: number,
  body: LoginJsonBody | null,
  nowMs: number = Date.now(),
): LoginApiResult {
  if (status >= 200 && status < 300) {
    return { kind: "success" };
  }

  const outcome = resolveOutcomeCode(body);

  if (outcome === "bad_password" || outcome === "invalid_password") {
    return { kind: "invalid_password" };
  }

  if (outcome === "locked") {
    return lockedResult(body, nowMs);
  }

  if (
    outcome === "misconfigured" ||
    outcome === "ops" ||
    outcome === "storage_unavailable"
  ) {
    return { kind: "misconfigured" };
  }

  if (status === 401) {
    return { kind: "invalid_password" };
  }

  if (status === 429) {
    return lockedResult(body, nowMs);
  }

  if (status === 503) {
    return { kind: "misconfigured" };
  }

  if (status >= 500) {
    return { kind: "network" };
  }

  return { kind: "invalid_password" };
}

async function readLoginJsonBody(response: Response): Promise<LoginJsonBody | null> {
  try {
    const text = await response.text();
    if (!text) return null;
    return JSON.parse(text) as LoginJsonBody;
  } catch {
    return null;
  }
}

export async function submitLogin(password: string): Promise<LoginApiResult> {
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify({ password }),
    });

    const body = await readLoginJsonBody(response);
    return mapLoginJsonResponse(response.status, body);
  } catch {
    return { kind: "network" };
  }
}
