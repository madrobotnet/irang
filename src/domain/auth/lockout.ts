import {
  FAILURE_WINDOW_MS,
  LOCKOUT_MS,
  MAX_FAILURES,
} from "./constants";
import type { LockoutStatus } from "./types";

export function evaluateLockout(
  now: number,
  lockedUntil: number | null,
): LockoutStatus {
  if (lockedUntil !== null && lockedUntil > now) {
    return {
      kind: "locked",
      lockedUntil,
      retryAfterMs: lockedUntil - now,
    };
  }
  return { kind: "ok" };
}

export function failuresInsideWindow(
  timestamps: number[],
  now: number,
  windowMs: number = FAILURE_WINDOW_MS,
): number[] {
  const since = now - windowMs;
  return timestamps.filter((t) => t > since && t <= now);
}

export function lockoutFromFailures(
  timestampsIncludingThisFailure: number[],
  now: number,
  maxFailures: number = MAX_FAILURES,
  lockoutMs: number = LOCKOUT_MS,
): { shouldLock: boolean; lockedUntil: number | null; failuresInWindow: number } {
  const inWindow = failuresInsideWindow(timestampsIncludingThisFailure, now);
  const failuresInWindow = inWindow.length;
  if (failuresInWindow >= maxFailures) {
    return {
      shouldLock: true,
      lockedUntil: now + lockoutMs,
      failuresInWindow,
    };
  }
  return { shouldLock: false, lockedUntil: null, failuresInWindow };
}

export function formatLockRetryCopy(retryAfterMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(retryAfterMs / 1000));
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");
  return `너무 많이 시도했어요. ${mm}:${ss} 뒤에 다시 해보세요.`;
}
