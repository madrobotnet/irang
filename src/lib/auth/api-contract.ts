/** Rex API_AUTH_CONTRACT response envelopes (server + middleware). */

export type ApiErrorCode =
  | "bad_password"
  | "locked"
  | "misconfigured"
  | "validation"
  | "unauthorized";

export function errorBody(code: ApiErrorCode): { ok: false; code: ApiErrorCode } {
  return { ok: false, code };
}

export function unauthorizedBody(): {
  ok: false;
  authenticated: false;
  code: "unauthorized";
} {
  return { ok: false, authenticated: false, code: "unauthorized" };
}

export function lockedBody(args: {
  retryAfterSec: number;
  unlockAt: string;
  message: string;
}): {
  ok: false;
  code: "locked";
  retryAfterSec: number;
  retryAfterSeconds: number;
  unlockAt: string;
  message: string;
} {
  return {
    ok: false,
    code: "locked",
    retryAfterSec: args.retryAfterSec,
    retryAfterSeconds: args.retryAfterSec,
    unlockAt: args.unlockAt,
    message: args.message,
  };
}

export function meOkBody(session: {
  publicId: string;
  createdAt: string;
  expiresAt: string;
}): {
  ok: true;
  authenticated: true;
  session: { id: string; createdAt: string; expiresAt: string };
} {
  return {
    ok: true,
    authenticated: true,
    session: {
      id: session.publicId,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    },
  };
}
