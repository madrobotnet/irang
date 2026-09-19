import {
  FAILURE_WINDOW_MS,
  LOCKOUT_MS,
  MAX_CONCURRENT_SESSIONS,
  MAX_FAILURES,
  SESSION_TTL_MS,
} from "./constants";

export type AuthRuntimeConfig = {
  maxFailures: number;
  failureWindowMs: number;
  lockoutMs: number;
  maxSessions: number;
  sessionTtlMs: number;
};

function positiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function authRuntimeConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): AuthRuntimeConfig {
  const failWindowMin = positiveInt(env.AUTH_FAIL_WINDOW_MIN, FAILURE_WINDOW_MS / 60_000);
  const lockMin = positiveInt(env.AUTH_LOCK_MIN, LOCKOUT_MS / 60_000);
  const ttlDays = positiveInt(env.AUTH_SESSION_TTL_DAYS, SESSION_TTL_MS / (24 * 60 * 60 * 1000));
  return {
    maxFailures: positiveInt(env.AUTH_FAIL_LIMIT, MAX_FAILURES),
    failureWindowMs: failWindowMin * 60_000,
    lockoutMs: lockMin * 60_000,
    maxSessions: positiveInt(env.AUTH_MAX_SESSIONS, MAX_CONCURRENT_SESSIONS),
    sessionTtlMs: ttlDays * 24 * 60 * 60 * 1000,
  };
}
