import { describe, expect, it } from "vitest";
import { authRuntimeConfigFromEnv } from "./env-config";

describe("authRuntimeConfigFromEnv", () => {
  it("uses contract defaults when env is unset", () => {
    const cfg = authRuntimeConfigFromEnv({});
    expect(cfg.maxFailures).toBe(5);
    expect(cfg.failureWindowMs).toBe(15 * 60_000);
    expect(cfg.lockoutMs).toBe(15 * 60_000);
    expect(cfg.maxSessions).toBe(5);
    expect(cfg.sessionTtlMs).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("reads overrides from env", () => {
    const cfg = authRuntimeConfigFromEnv({
      AUTH_FAIL_LIMIT: "3",
      AUTH_FAIL_WINDOW_MIN: "10",
      AUTH_LOCK_MIN: "20",
      AUTH_MAX_SESSIONS: "4",
      AUTH_SESSION_TTL_DAYS: "1",
    });
    expect(cfg.maxFailures).toBe(3);
    expect(cfg.failureWindowMs).toBe(10 * 60_000);
    expect(cfg.lockoutMs).toBe(20 * 60_000);
    expect(cfg.maxSessions).toBe(4);
    expect(cfg.sessionTtlMs).toBe(24 * 60 * 60 * 1000);
  });
});
