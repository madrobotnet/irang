import { afterEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE_NAME } from "@/domain/auth/constants";
import {
  InMemoryAuditRepository,
  InMemoryLockoutRepository,
  InMemorySessionRepository,
} from "./memory";
import { createAuthService, createMemoryAuthDeps, setAuthRuntimeForTests } from "./runtime";
import { sha256TokenHasher } from "./crypto";
import { resolveAppSessionGate } from "./app-session-guard";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";

function installRuntime() {
  const sessions = new InMemorySessionRepository();
  const deps = createMemoryAuthDeps({
    sessions,
    lockouts: new InMemoryLockoutRepository(),
    audit: new InMemoryAuditRepository(),
    passwordHashEnv: "stored-hash",
    passwords: {
      async verify(hash, password) {
        return hash === "stored-hash" && password === "ok-password";
      },
    },
    tokens: {
      nextToken() {
        return `opaque-token-${"a".repeat(40)}`;
      },
    },
    tokenHasher: sha256TokenHasher,
  });
  const service = createAuthService(deps);
  setAuthRuntimeForTests({ service, deps });
  return { service };
}

afterEach(() => {
  setAuthRuntimeForTests(null);
  vi.mocked(cookies).mockReset();
});

describe("Ada/Quinn acceptance — in-process page session gate", () => {
  it("fake sb_session is invalid (no HTTP self-fetch)", async () => {
    installRuntime();
    vi.mocked(cookies).mockResolvedValue({
      get: (name: string) =>
        name === SESSION_COOKIE_NAME ? { value: "not-a-real-session-token" } : undefined,
    } as never);

    const gate = await resolveAppSessionGate();
    expect(gate.kind).toBe("invalid");
  });

  it("valid session passes in-process gate", async () => {
    const { service } = installRuntime();
    const login = await service.login({ password: "ok-password", clientKey: "test" });
    expect(login.kind).toBe("ok");
    if (login.kind !== "ok") {
      return;
    }
    vi.mocked(cookies).mockResolvedValue({
      get: (name: string) =>
        name === SESSION_COOKIE_NAME ? { value: login.sessionToken } : undefined,
    } as never);

    const gate = await resolveAppSessionGate();
    expect(gate.kind).toBe("ok");
  });
});
