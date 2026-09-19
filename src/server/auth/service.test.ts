import { describe, expect, it } from "vitest";
import { argon2id, hash as argon2Hash } from "argon2";
import { FAILURE_WINDOW_MS, LOCKOUT_MS, MAX_CONCURRENT_SESSIONS } from "@/domain/auth/constants";
import {
  InMemoryAuditRepository,
  InMemoryLockoutRepository,
  InMemorySessionRepository,
} from "./memory";
import { createAuthService, createMemoryAuthDeps } from "./runtime";
import { sha256TokenHasher } from "./crypto";
import { argon2PasswordVerifier } from "./crypto";

function setup(nowRef: { now: number }) {
  const sessions = new InMemorySessionRepository();
  const lockouts = new InMemoryLockoutRepository();
  const audit = new InMemoryAuditRepository();
  let seq = 0;
  const deps = createMemoryAuthDeps({
    sessions,
    lockouts,
    audit,
    passwordHashEnv: "stored-hash",
    passwords: {
      async verify(hash, password) {
        return hash === "stored-hash" && password === "ok-password";
      },
    },
    clock: { now: () => nowRef.now },
    tokens: {
      nextToken() {
        seq += 1;
        return `opaque-token-${seq}-${"x".repeat(40)}`;
      },
    },
    tokenHasher: sha256TokenHasher,
  });
  return { service: createAuthService(deps), sessions, lockouts, audit, deps };
}

describe("AuthService", () => {
  it("rejects empty password as validation without counting lockout", async () => {
    const { service, lockouts } = setup({ now: 1_000_000 });
    const result = await service.login({ password: "", clientKey: "ip-1" });
    expect(result.kind).toBe("validation");
    const failures = await lockouts.listFailuresSince("ip-1", 0);
    expect(failures).toHaveLength(0);
  });

  it("locks after 5 bad passwords in 15 minutes", async () => {
    const nowRef = { now: 1_000_000 };
    const { service } = setup(nowRef);
    for (let i = 0; i < 4; i++) {
      const result = await service.login({ password: "nope", clientKey: "ip-1" });
      expect(result.kind).toBe("bad_password");
    }
    const fifth = await service.login({ password: "nope", clientKey: "ip-1" });
    expect(fifth).toMatchObject({ kind: "locked", retryAfterMs: LOCKOUT_MS });
  });

  it("drops the oldest session when concurrent sessions exceed 5", async () => {
    const nowRef = { now: 1_000_000 };
    const { service, sessions, audit } = setup(nowRef);
    const tokens: string[] = [];
    for (let i = 0; i < MAX_CONCURRENT_SESSIONS + 1; i++) {
      nowRef.now += 1000;
      const result = await service.login({ password: "ok-password", clientKey: `device-${i}` });
      expect(result.kind).toBe("ok");
      if (result.kind === "ok") {
        tokens.push(result.sessionToken);
      }
    }
    const firstHash = await sha256TokenHasher.hash(tokens[0]!);
    expect(await sessions.findByTokenHashHex(firstHash)?.revokedAt).not.toBeNull();
    expect(audit.events.some((e) => e.kind === "session_drop")).toBe(true);
  });

  it("writes audit events for login ok and logout", async () => {
    const nowRef = { now: Date.now() };
    const { service, audit } = setup(nowRef);
    const login = await service.login({ password: "ok-password", clientKey: "ip-1" });
    expect(login.kind).toBe("ok");
    if (login.kind !== "ok") {
      return;
    }
    expect(audit.events.some((e) => e.kind === "login_ok")).toBe(true);
    await service.logout(login.sessionToken, "ip-1");
    expect(audit.events.some((e) => e.kind === "logout")).toBe(true);
  });

  it("returns misconfigured when password hash is missing", async () => {
    const deps = createMemoryAuthDeps({ passwordHashEnv: "" });
    const service = createAuthService(deps);
    await expect(service.login({ password: "x", clientKey: "ip" })).resolves.toEqual({
      kind: "misconfigured",
    });
  });
});

describe("argon2 password verifier", () => {
  it("verifies an argon2id hash", async () => {
    const password = "ok-password";
    const hash = await argon2Hash(password, {
      type: argon2id,
      memoryCost: 4096,
      timeCost: 1,
      parallelism: 1,
    });
    await expect(argon2PasswordVerifier.verify(hash, password)).resolves.toBe(true);
    await expect(argon2PasswordVerifier.verify(hash, "wrong")).resolves.toBe(false);
  });
});
