export const MAX_FAILURES = 5;
export const FAILURE_WINDOW_MS = 15 * 60 * 1000;
export const LOCKOUT_MS = 15 * 60 * 1000;

/** E1-S2 lock: concurrent sessions max 5; overflow drops oldest by createdAt. */
export const MAX_CONCURRENT_SESSIONS = 5;
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_TTL_SECONDS = SESSION_TTL_MS / 1000;

export const SESSION_COOKIE_NAME = "sb_session";
