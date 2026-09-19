export type SessionRecord = {
  publicId: string;
  tokenHashHex: string;
  createdAt: number;
  expiresAt: number;
  revokedAt: number | null;
};

export type LockoutStatus =
  | { kind: "ok" }
  | { kind: "locked"; lockedUntil: number; retryAfterMs: number };

export type LoginResult =
  | { kind: "ok"; sessionToken: string; publicSessionId: string; expiresAt: number }
  | { kind: "bad_password" }
  | { kind: "validation" }
  | { kind: "locked"; retryAfterMs: number; lockedUntil: number }
  | { kind: "misconfigured" };

export type SessionCookieAttributes = {
  httpOnly: true;
  secure: true;
  sameSite: "lax";
  path: "/";
  maxAgeSeconds: number;
};

export type AuditKind =
  | "login_ok"
  | "login_fail"
  | "lockout"
  | "logout"
  | "session_drop";
