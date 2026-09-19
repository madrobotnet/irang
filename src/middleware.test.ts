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
import { ATTACHMENT_MAX_REQUEST_BODY_BYTES } from "@/lib/notes/attachment-upload-limit";

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

function wireSessionFetch() {
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("/api/auth/me")) {
        return handleMe(new Request(url, init));
      }
      throw new Error(`unexpected fetch in middleware test: ${url}`);
    },
  );
}

beforeEach(() => {
  wireSessionFetch();
});

afterEach(() => {
  setAuthRuntimeForTests(null);
  vi.unstubAllGlobals();
});

describe("middleware gate", () => {
  it("redirects unauthenticated pages to /login", async () => {
    const response = await middleware(new NextRequest("https://brain.madrobot.net/"));
    expect(response.status).toBe(302);
    expect(new URL(response.headers.get("location") ?? "", "https://brain.madrobot.net").pathname).toBe(
      "/login",
    );
  });

  it("redirects protected AppShell routes with a forged session cookie", async () => {
    installRuntime();
    const forged = `${"a".repeat(43)}`;
    for (const path of ["/chat", "/search", "/inbox", "/notes"]) {
      const response = await middleware(
        new NextRequest(`https://brain.madrobot.net${path}`, {
          headers: { cookie: `${SESSION_COOKIE_NAME}=${forged}` },
        }),
      );
      expect(response.status).toBe(302);
      expect(new URL(response.headers.get("location") ?? "", "https://brain.madrobot.net").pathname).toBe(
        "/login",
      );
    }
  });

  it("allows protected pages when the session is verified via auth lookup", async () => {
    const { service } = installRuntime();
    const login = await service.login({ password: "ok-password", clientKey: "test" });
    expect(login.kind).toBe("ok");
    if (login.kind !== "ok") {
      return;
    }
    const cookie = `${SESSION_COOKIE_NAME}=${login.sessionToken}`;
    for (const path of ["/chat", "/notes"]) {
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

  it("returns 413 for attachment upload when Content-Length exceeds limit (authenticated)", async () => {
    const { service } = installRuntime();
    const login = await service.login({ password: "ok-password", clientKey: "test" });
    expect(login.kind).toBe("ok");
    if (login.kind !== "ok") {
      return;
    }
    const cookie = `${SESSION_COOKIE_NAME}=${login.sessionToken}`;
    const response = await middleware(
      new NextRequest("https://brain.madrobot.net/api/attachments", {
        method: "POST",
        headers: {
          cookie,
          "content-type": "multipart/form-data; boundary=----test",
          "content-length": String(ATTACHMENT_MAX_REQUEST_BODY_BYTES + 1),
        },
      }),
    );
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ ok: false, code: "payload_too_large" });
  });

  it("returns 401 (not 413) for oversize attachment upload without session", async () => {
    const response = await middleware(
      new NextRequest("https://brain.madrobot.net/api/attachments", {
        method: "POST",
        headers: {
          "content-type": "multipart/form-data; boundary=----test",
          "content-length": String(ATTACHMENT_MAX_REQUEST_BODY_BYTES + 1),
        },
      }),
    );
    expect(response.status).toBe(401);
  });

  it("sets security headers on gated responses", async () => {
    const response = await middleware(new NextRequest("https://brain.madrobot.net/"));
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      expect(response.headers.get(key)).toBe(value);
    }
  });
});
