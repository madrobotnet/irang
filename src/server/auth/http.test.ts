import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from "@/domain/auth/constants";
import {
  InMemoryAuditRepository,
  InMemoryLockoutRepository,
  InMemorySessionRepository,
} from "./memory";
import { createAuthService, createMemoryAuthDeps, setAuthRuntimeForTests } from "./runtime";
import { sha256TokenHasher } from "./crypto";
import { handleLogin, handleLogout, handleMe } from "./http";
import { SECURITY_HEADERS } from "@/lib/auth/security-headers";
import { readSessionCookie } from "@/lib/auth/cookie";

function installRuntime() {
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
    tokens: {
      nextToken() {
        seq += 1;
        return `opaque-token-${seq}-${"a".repeat(40)}`;
      },
    },
    tokenHasher: sha256TokenHasher,
  });
  setAuthRuntimeForTests({ service: createAuthService(deps), deps });
  return { audit };
}

afterEach(() => {
  setAuthRuntimeForTests(null);
});

function cookieFrom(response: Response): string | null {
  return response.headers.get("set-cookie");
}

describe("auth HTTP handlers (API_AUTH_CONTRACT)", () => {
  it("GET /me unauthenticated returns contract 401 JSON", async () => {
    installRuntime();
    const response = await handleMe(new Request("http://brain.madrobot.net/api/auth/me"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      ok: false,
      authenticated: false,
      code: "unauthorized",
    });
  });

  it("login success returns ok:true and gated cookie", async () => {
    installRuntime();
    const login = await handleLogin(
      new Request("http://brain.madrobot.net/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "ok-password" }),
      }),
    );
    expect(login.status).toBe(200);
    expect(await login.json()).toEqual({ ok: true });
    const setCookie = cookieFrom(login)!;
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain(`Max-Age=${SESSION_TTL_SECONDS}`);
  });

  it("bad password returns 401 bad_password", async () => {
    installRuntime();
    const response = await handleLogin(
      new Request("http://brain.madrobot.net/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "wrong" }),
      }),
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ ok: false, code: "bad_password" });
  });

  it("empty password returns 400 validation", async () => {
    installRuntime();
    const response = await handleLogin(
      new Request("http://brain.madrobot.net/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "" }),
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, code: "validation" });
  });

  it("locked returns 429 with retryAfterSec and unlockAt", async () => {
    installRuntime();
    for (let i = 0; i < 5; i++) {
      await handleLogin(
        new Request("http://brain.madrobot.net/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" },
          body: JSON.stringify({ password: "wrong" }),
        }),
      );
    }
    const locked = await handleLogin(
      new Request("http://brain.madrobot.net/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" },
        body: JSON.stringify({ password: "wrong" }),
      }),
    );
    expect(locked.status).toBe(429);
    const body = (await locked.json()) as {
      ok: boolean;
      code: string;
      retryAfterSec: number;
      unlockAt: string;
    };
    expect(body.ok).toBe(false);
    expect(body.code).toBe("locked");
    expect(body.retryAfterSec).toBeGreaterThan(0);
    expect(body.retryAfterSeconds).toBe(body.retryAfterSec);
    expect(body.unlockAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(locked.status).not.toBe(423);
  });

  it("login lock responses are 429 in the handler source", () => {
    const source = readFileSync(new URL("./http.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/\b423\b/);
    expect(source).toMatch(/json\(body, 429\)/);
  });

  it("logout clears cookie and me returns unauthorized", async () => {
    installRuntime();
    const login = await handleLogin(
      new Request("http://brain.madrobot.net/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "ok-password" }),
      }),
    );
    const cookiePair = cookieFrom(login)!.split(";")[0]!;
    const token = readSessionCookie(cookiePair);
    const logout = await handleLogout(
      new Request("http://brain.madrobot.net/api/auth/logout", {
        method: "POST",
        headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
      }),
    );
    expect(logout.status).toBe(204);
    expect(cookieFrom(logout)).toContain("Max-Age=0");
    const me = await handleMe(
      new Request("http://brain.madrobot.net/api/auth/me", {
        headers: { cookie: cookiePair },
      }),
    );
    expect(me.status).toBe(401);
  });

  it("authenticated me returns session envelope", async () => {
    installRuntime();
    const login = await handleLogin(
      new Request("http://brain.madrobot.net/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "ok-password" }),
      }),
    );
    const cookiePair = cookieFrom(login)!.split(";")[0]!;
    const me = await handleMe(
      new Request("http://brain.madrobot.net/api/auth/me", { headers: { cookie: cookiePair } }),
    );
    expect(me.status).toBe(200);
    const body = (await me.json()) as {
      ok: boolean;
      authenticated: boolean;
      session: { id: string; expiresAt: string; createdAt: string };
    };
    expect(body.ok).toBe(true);
    expect(body.authenticated).toBe(true);
    expect(body.session.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("applies security headers", async () => {
    installRuntime();
    const response = await handleMe(new Request("http://brain.madrobot.net/api/auth/me"));
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      expect(response.headers.get(key)).toBe(value);
    }
  });
});
