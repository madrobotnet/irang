import { afterEach, describe, expect, it } from "vitest";
import { POST } from "./route";
import {
  InMemoryAuditRepository,
  InMemoryLockoutRepository,
  InMemorySessionRepository,
} from "@/server/auth/memory";
import { createAuthService, createMemoryAuthDeps, setAuthRuntimeForTests } from "@/server/auth/runtime";

function installRuntime() {
  setAuthRuntimeForTests({
    service: createAuthService(
      createMemoryAuthDeps({
        sessions: new InMemorySessionRepository(),
        lockouts: new InMemoryLockoutRepository(),
        audit: new InMemoryAuditRepository(),
        passwordHashEnv: "stored-hash",
      }),
    ),
    deps: createMemoryAuthDeps({ passwordHashEnv: "stored-hash" }),
  });
}

afterEach(() => {
  setAuthRuntimeForTests(null);
});

describe("POST /api/auth/login route", () => {
  it("text/plain returns 400 validation JSON via route handler", async () => {
    installRuntime();
    const response = await POST(
      new Request("http://brain.madrobot.net/api/auth/login", {
        method: "POST",
        headers: { "content-type": "text/plain", accept: "application/json" },
        body: "password=x",
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, code: "validation" });
  });
});
