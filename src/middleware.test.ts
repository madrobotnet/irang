import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { SECURITY_HEADERS } from "@/lib/auth/security-headers";
import { SESSION_COOKIE_NAME } from "@/domain/auth/constants";
import {
  InMemoryAuditRepository,
  InMemoryLockoutRepository,
  InMemorySessionRepository,
} from "@/server/auth/memory";
import { createAuthService, createMemoryAuthDeps, setAuthRuntimeForTests } from "@/server/auth/runtime";
import { sha256TokenHasher } from "@/server/auth/crypto";
import { handleMe } from "@/server/auth/http";
import { E2_PROTECTED_API_ROUTES } from "@/lib/auth/e2-gate-paths";
import { E3_PROTECTED_API_ROUTES, E3_PROTECTED_PAGE_ROUTES } from "@/lib/auth/e3-gate-paths";
import { E4_PROTECTED_API_ROUTES, E4_PROTECTED_PAGE_ROUTES } from "@/lib/auth/e4-gate-paths";
import { E5_PROTECTED_API_ROUTES, E5_PROTECTED_PAGE_ROUTES } from "@/lib/auth/e5-gate-paths";
import {
  E6_PROTECTED_API_ROUTES,
  E6_PROTECTED_PAGE_ROUTES,
  E6_PUBLIC_PWA_PATHS,
} from "@/lib/auth/e6-gate-paths";
import { E7_PROTECTED_API_ROUTES, E7_PROTECTED_PAGE_ROUTES } from "@/lib/auth/e7-gate-paths";

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
  const service = createAuthService(deps);
  setAuthRuntimeForTests({ service, deps });
  return { service };
}

function wireInternalSessionFetch() {
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      expect(url).toMatch(/^http:\/\/127\.0\.0\.1:3000\/api\/auth\/me/);
      expect(url).not.toContain("brain.madrobot.net");
      if (url.includes("/api/auth/me")) {
        return handleMe(new Request(url, init));
      }
      throw new Error(`unexpected fetch in middleware test: ${url}`);
    },
  );
}

beforeEach(() => {
  wireInternalSessionFetch();
});

afterEach(() => {
  setAuthRuntimeForTests(null);
  vi.unstubAllGlobals();
});

describe("middleware gate (P0: GET / with session cookie)", () => {
  it("Ada/Quinn P0#1: fake sb_session + GET / is not 500 and does not self-fetch", async () => {
    const fetchSpy = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    vi.stubGlobal("fetch", fetchSpy);
    const response = await middleware(
      new NextRequest("https://brain.madrobot.net/", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=any-fake-session-value` },
      }),
    );
    expect(response.status).not.toBe(500);
    expect(response.status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated pages to /login", async () => {
    const response = await middleware(new NextRequest("https://brain.madrobot.net/"));
    expect(response.status).toBe(302);
    expect(new URL(response.headers.get("location") ?? "", "https://brain.madrobot.net").pathname).toBe(
      "/login",
    );
    const csp = response.headers.get("Content-Security-Policy") ?? "";
    expect(csp).toMatch(/'nonce-[^']+'/);
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).not.toBe(SECURITY_HEADERS["Content-Security-Policy"]);
  });

  it("passes forged session cookies on pages to in-process layout gate (middleware 200)", async () => {
    const forged = `${"a".repeat(43)}`;
    for (const path of ["/chat", "/search", "/inbox", "/notes"]) {
      const response = await middleware(
        new NextRequest(`https://brain.madrobot.net${path}`, {
          headers: { cookie: `${SESSION_COOKIE_NAME}=${forged}` },
        }),
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
    }
  });

  it("API routes return 401 when loopback me fetch fails (no 500)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    const response = await middleware(
      new NextRequest("https://brain.madrobot.net/api/notes", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=any-fake-session-value` },
      }),
    );
    expect(response.status).toBe(401);
    expect(response.status).not.toBe(500);
  });

  it("loopbacks API session check to http://127.0.0.1:3000 (not public https)", async () => {
    const { service } = installRuntime();
    const login = await service.login({ password: "ok-password", clientKey: "test" });
    expect(login.kind).toBe("ok");
    if (login.kind !== "ok") {
      return;
    }
    const seenUrls: string[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      seenUrls.push(url);
      expect(url).toMatch(/^http:\/\/127\.0\.0\.1:3000\/api\/auth\/me/);
      return handleMe(new Request(url, init));
    });
    const cookie = `${SESSION_COOKIE_NAME}=${login.sessionToken}`;
    const response = await middleware(
      new NextRequest("https://brain.madrobot.net/api/notes", {
        headers: { cookie },
      }),
    );
    expect(response.status).toBe(200);
    expect(seenUrls.some((u) => u.includes("/api/auth/me"))).toBe(true);
    expect(seenUrls.every((u) => !u.startsWith("https://brain.madrobot.net"))).toBe(true);
  });

  it("allows protected pages when the session is verified via auth lookup", async () => {
    const { service } = installRuntime();
    const login = await service.login({ password: "ok-password", clientKey: "test" });
    expect(login.kind).toBe("ok");
    if (login.kind !== "ok") {
      return;
    }
    const cookie = `${SESSION_COOKIE_NAME}=${login.sessionToken}`;
    for (const path of ["/chat", "/notes", "/inbox", "/search"]) {
      const response = await middleware(
        new NextRequest(`https://brain.madrobot.net${path}`, {
          headers: { cookie },
        }),
      );
      expect(response.status).toBe(200);
    }
  });

  it("allows verified session through middleware for E2 APIs (handler enforces business rules)", async () => {
    const { service } = installRuntime();
    const login = await service.login({ password: "ok-password", clientKey: "test" });
    expect(login.kind).toBe("ok");
    if (login.kind !== "ok") {
      return;
    }
    const cookie = `${SESSION_COOKIE_NAME}=${login.sessionToken}`;
    const response = await middleware(
      new NextRequest("https://brain.madrobot.net/api/capture", {
        headers: { cookie },
      }),
    );
    expect(response.status).toBe(200);
  });

  it("returns contract 401 JSON for unauthenticated protected APIs", async () => {
    const response = await middleware(
      new NextRequest("https://brain.madrobot.net/api/notes"),
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      ok: false,
      authenticated: false,
      code: "unauthorized",
    });
    const csp = response.headers.get("Content-Security-Policy") ?? "";
    expect(csp).toMatch(/'nonce-[^']+'/);
    expect(csp).toContain("'strict-dynamic'");
  });

  it("returns 401 for protected APIs with a forged session cookie", async () => {
    installRuntime();
    const forged = `${"b".repeat(43)}`;
    const response = await middleware(
      new NextRequest("https://brain.madrobot.net/api/notes", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${forged}` },
      }),
    );
    expect(response.status).toBe(401);
  });

  it("returns 401 for unauthenticated E2 APIs", async () => {
    for (const path of E2_PROTECTED_API_ROUTES) {
      const response = await middleware(new NextRequest(`https://brain.madrobot.net${path}`));
      expect(response.status).toBe(401);
    }
  });

  it("redirects unauthenticated inbox and returns 401 for inbox APIs", async () => {
    for (const path of E3_PROTECTED_PAGE_ROUTES) {
      const response = await middleware(new NextRequest(`https://brain.madrobot.net${path}`));
      expect(response.status).toBe(302);
      expect(new URL(response.headers.get("location") ?? "", "https://brain.madrobot.net").pathname).toBe(
        "/login",
      );
    }
    for (const path of E3_PROTECTED_API_ROUTES) {
      const response = await middleware(new NextRequest(`https://brain.madrobot.net${path}`));
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        ok: false,
        authenticated: false,
        code: "unauthorized",
      });
    }
  });

  it("allows a verified session through middleware for search APIs", async () => {
    const { service } = installRuntime();
    const login = await service.login({ password: "ok-password", clientKey: "test" });
    expect(login.kind).toBe("ok");
    if (login.kind !== "ok") {
      return;
    }
    const cookie = `${SESSION_COOKIE_NAME}=${login.sessionToken}`;
    for (const path of E4_PROTECTED_API_ROUTES) {
      const response = await middleware(
        new NextRequest(`https://brain.madrobot.net${path}`, {
          headers: { cookie },
        }),
      );
      expect(response.status).toBe(200);
    }
  });

  it("redirects unauthenticated search and returns 401 for search APIs", async () => {
    for (const path of E4_PROTECTED_PAGE_ROUTES) {
      const response = await middleware(new NextRequest(`https://brain.madrobot.net${path}`));
      expect(response.status).toBe(302);
      expect(new URL(response.headers.get("location") ?? "", "https://brain.madrobot.net").pathname).toBe(
        "/login",
      );
    }
    for (const path of E4_PROTECTED_API_ROUTES) {
      const response = await middleware(new NextRequest(`https://brain.madrobot.net${path}`));
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        ok: false,
        authenticated: false,
        code: "unauthorized",
      });
    }
  });

  it("returns 401 for search APIs with a forged session cookie", async () => {
    installRuntime();
    const forged = `${"d".repeat(43)}`;
    for (const path of E4_PROTECTED_API_ROUTES) {
      const response = await middleware(
        new NextRequest(`https://brain.madrobot.net${path}`, {
          headers: { cookie: `${SESSION_COOKIE_NAME}=${forged}` },
        }),
      );
      expect(response.status).toBe(401);
    }
  });

  it("allows a verified session through middleware for chat APIs", async () => {
    const { service } = installRuntime();
    const login = await service.login({ password: "ok-password", clientKey: "test" });
    expect(login.kind).toBe("ok");
    if (login.kind !== "ok") {
      return;
    }
    const cookie = `${SESSION_COOKIE_NAME}=${login.sessionToken}`;
    for (const path of E5_PROTECTED_API_ROUTES) {
      const response = await middleware(
        new NextRequest(`https://brain.madrobot.net${path}`, {
          headers: { cookie },
        }),
      );
      expect(response.status).toBe(200);
    }
  });

  it("redirects unauthenticated chat and returns 401 for chat APIs", async () => {
    for (const path of E5_PROTECTED_PAGE_ROUTES) {
      const response = await middleware(new NextRequest(`https://brain.madrobot.net${path}`));
      expect(response.status).toBe(302);
      expect(new URL(response.headers.get("location") ?? "", "https://brain.madrobot.net").pathname).toBe(
        "/login",
      );
    }
    for (const path of E5_PROTECTED_API_ROUTES) {
      const response = await middleware(new NextRequest(`https://brain.madrobot.net${path}`));
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        ok: false,
        authenticated: false,
        code: "unauthorized",
      });
    }
  });

  it("returns 401 for chat APIs with a forged session cookie", async () => {
    installRuntime();
    const forged = `${"e".repeat(43)}`;
    for (const path of E5_PROTECTED_API_ROUTES) {
      const response = await middleware(
        new NextRequest(`https://brain.madrobot.net${path}`, {
          headers: { cookie: `${SESSION_COOKIE_NAME}=${forged}` },
        }),
      );
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        ok: false,
        authenticated: false,
        code: "unauthorized",
      });
    }
  });

  it("returns 401 for inbox APIs with a forged session cookie", async () => {
    installRuntime();
    const forged = `${"c".repeat(43)}`;
    for (const path of E3_PROTECTED_API_ROUTES) {
      const response = await middleware(
        new NextRequest(`https://brain.madrobot.net${path}`, {
          headers: { cookie: `${SESSION_COOKIE_NAME}=${forged}` },
        }),
      );
      expect(response.status).toBe(401);
    }
  });

  it("returns 401 for contract chat paths without a verified session", async () => {
    const paths = [
      "/api/chat/threads",
      "/api/chat/threads/thread-id",
      "/api/chat/threads/thread-id/messages",
      "/api/chat/proposals",
      "/api/chat/proposals/proposal-id/approve",
      "/api/chat/proposals/proposal-id/reject",
      "/api/chat/manage/suggest",
    ];
    for (const path of paths) {
      const response = await middleware(new NextRequest(`https://brain.madrobot.net${path}`));
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        ok: false,
        authenticated: false,
        code: "unauthorized",
      });
    }
    installRuntime();
    const forged = `${"f".repeat(43)}`;
    for (const path of paths) {
      const response = await middleware(
        new NextRequest(`https://brain.madrobot.net${path}`, {
          headers: { cookie: `${SESSION_COOKIE_NAME}=${forged}` },
        }),
      );
      expect(response.status).toBe(401);
    }
  });

  it("allows a verified session through middleware for the home page and summary API", async () => {
    const { service } = installRuntime();
    const login = await service.login({ password: "ok-password", clientKey: "test" });
    expect(login.kind).toBe("ok");
    if (login.kind !== "ok") {
      return;
    }
    const cookie = `${SESSION_COOKIE_NAME}=${login.sessionToken}`;
    for (const path of [...E6_PROTECTED_PAGE_ROUTES, ...E6_PROTECTED_API_ROUTES]) {
      const response = await middleware(
        new NextRequest(`https://brain.madrobot.net${path}`, {
          headers: { cookie },
        }),
      );
      expect(response.status).toBe(200);
    }
  });

  it("redirects unauthenticated home and returns 401 for the home summary API", async () => {
    for (const path of E6_PROTECTED_PAGE_ROUTES) {
      const response = await middleware(new NextRequest(`https://brain.madrobot.net${path}`));
      expect(response.status).toBe(302);
      expect(new URL(response.headers.get("location") ?? "", "https://brain.madrobot.net").pathname).toBe(
        "/login",
      );
    }
    for (const path of E6_PROTECTED_API_ROUTES) {
      const response = await middleware(new NextRequest(`https://brain.madrobot.net${path}`));
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        ok: false,
        authenticated: false,
        code: "unauthorized",
      });
    }
  });

  it("returns 401 for the home summary API with a forged session cookie", async () => {
    installRuntime();
    const forged = `${"g".repeat(43)}`;
    for (const path of E6_PROTECTED_API_ROUTES) {
      const response = await middleware(
        new NextRequest(`https://brain.madrobot.net${path}`, {
          headers: { cookie: `${SESSION_COOKIE_NAME}=${forged}` },
        }),
      );
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        ok: false,
        authenticated: false,
        code: "unauthorized",
      });
    }
  });

  it("passes forged session cookies on home routes to layout gate (middleware 200)", async () => {
    const forged = `${"h".repeat(43)}`;
    for (const path of E6_PROTECTED_PAGE_ROUTES) {
      const response = await middleware(
        new NextRequest(`https://brain.madrobot.net${path}`, {
          headers: { cookie: `${SESSION_COOKIE_NAME}=${forged}` },
        }),
      );
      expect(response.status).toBe(200);
    }
  });

  it("serves the manifest and icons without a session", async () => {
    for (const path of E6_PUBLIC_PWA_PATHS) {
      const response = await middleware(new NextRequest(`https://brain.madrobot.net${path}`));
      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
    }
  });

  it("redirects an unauthenticated graph page and returns 401 for graph APIs", async () => {
    for (const path of E7_PROTECTED_PAGE_ROUTES) {
      const response = await middleware(new NextRequest(`https://brain.madrobot.net${path}`));
      expect(response.status).toBe(302);
      expect(new URL(response.headers.get("location") ?? "", "https://brain.madrobot.net").pathname).toBe(
        "/login",
      );
    }
    for (const path of E7_PROTECTED_API_ROUTES) {
      const response = await middleware(new NextRequest(`https://brain.madrobot.net${path}`));
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        ok: false,
        authenticated: false,
        code: "unauthorized",
      });
    }
  });

  it("allows a verified session through middleware for graph APIs", async () => {
    const { service } = installRuntime();
    const login = await service.login({ password: "ok-password", clientKey: "test" });
    expect(login.kind).toBe("ok");
    if (login.kind !== "ok") {
      return;
    }
    const cookie = `${SESSION_COOKIE_NAME}=${login.sessionToken}`;
    for (const path of E7_PROTECTED_API_ROUTES) {
      const response = await middleware(
        new NextRequest(`https://brain.madrobot.net${path}`, {
          headers: { cookie },
        }),
      );
      expect(response.status).toBe(200);
    }
  });

  it("sets security headers on gated responses", async () => {
    const response = await middleware(new NextRequest("https://brain.madrobot.net/"));
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      if (key === "Content-Security-Policy") {
        const csp = response.headers.get(key) ?? "";
        expect(csp).toMatch(/'nonce-[^']+'/);
        expect(csp).toContain("'strict-dynamic'");
        continue;
      }
      expect(response.headers.get(key)).toBe(value);
    }
  });

  it("sets nonce CSP on document pass-through for App Router scripts", async () => {
    const response = await middleware(new NextRequest("https://brain.madrobot.net/login"));
    expect(response.status).toBe(200);
    const csp = response.headers.get("Content-Security-Policy") ?? "";
    const nonceMatch = csp.match(/'nonce-([^']+)'/);
    expect(nonceMatch).not.toBeNull();
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
  });
});
