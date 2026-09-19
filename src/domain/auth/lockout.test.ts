import { describe, expect, it } from "vitest";
import {
  evaluateLockout,
  failuresInsideWindow,
  formatLockRetryCopy,
  lockoutFromFailures,
} from "./lockout";
import { FAILURE_WINDOW_MS, LOCKOUT_MS, MAX_FAILURES } from "./constants";

describe("lockout policy", () => {
  it("is ok when not locked", () => {
    expect(evaluateLockout(1000, null)).toEqual({ kind: "ok" });
    expect(evaluateLockout(1000, 1000)).toEqual({ kind: "ok" });
  });

  it("reports remaining lock time", () => {
    expect(evaluateLockout(1000, 2500)).toEqual({
      kind: "locked",
      lockedUntil: 2500,
      retryAfterMs: 1500,
    });
  });

  it("counts only failures inside the 15 minute window", () => {
    const now = FAILURE_WINDOW_MS + 50;
    const kept = failuresInsideWindow([0, 1, now - 1, now], now);
    expect(kept).toEqual([now - 1, now]);
  });

  it("locks on the 5th failure inside 15 minutes", () => {
    const now = 10_000;
    const timestamps = Array.from({ length: MAX_FAILURES }, (_, i) => now - i);
    const result = lockoutFromFailures(timestamps, now);
    expect(result.shouldLock).toBe(true);
    expect(result.lockedUntil).toBe(now + LOCKOUT_MS);
    expect(result.failuresInWindow).toBe(5);
  });

  it("counts repeated timestamps at the same instant", () => {
    const now = 10_000;
    const timestamps = Array.from({ length: MAX_FAILURES }, () => now);
    expect(lockoutFromFailures(timestamps, now).shouldLock).toBe(true);
  });

  it("does not lock after 4 failures", () => {
    const now = 10_000;
    const timestamps = [now - 3, now - 2, now - 1, now];
    expect(lockoutFromFailures(timestamps, now).shouldLock).toBe(false);
  });

  it("formats the WIRE lock copy as mm:ss", () => {
    expect(formatLockRetryCopy(15 * 60 * 1000)).toBe(
      "너무 많이 시도했어요. 15:00 뒤에 다시 해보세요.",
    );
    expect(formatLockRetryCopy(65_000)).toBe(
      "너무 많이 시도했어요. 01:05 뒤에 다시 해보세요.",
    );
  });
});
