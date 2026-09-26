import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/domain/auth/constants";
import { handleMe } from "@/server/auth/http";
import { hasValidSessionForMiddleware } from "./middleware-session-gate";
import { hasVerifiedSessionForApi } from "./verify-session-api";

function wireInternalMeFetch() {
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      expect(url).toMatch(/^http:\/\/127\.0\.0\.1:3000\/api\/auth\/me/);
      expect(url).not.toMatch(/^https:\/\//);
      if (url.includes("/api/auth/me")) {
        return handleMe(new Request(url, init));
      }
      throw new Error(`unexpected fetch: ${url}`);
    },
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.INTERNAL_APP_URL;
});

describe("middleware session gate", () => {
  it("does not fetch for page routes when a session cookie is present", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const ok = await hasValidSessionForMiddleware(
      new NextRequest("https://brain.madrobot.net/", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=fake-token` },
      }),
      "/",
    );
    expect(ok).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("API routes loopback to 127.0.0.1, never public https", async () => {
    wireInternalMeFetch();
    const forged = `${"c".repeat(43)}`;
    const ok = await hasVerifiedSessionForApi(
      new NextRequest("https://brain.madrobot.net/api/notes", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${forged}` },
      }),
    );
    expect(ok).toBe(false);
  });

  it("returns false when API loopback fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    const ok = await hasVerifiedSessionForApi(
      new NextRequest("https://brain.madrobot.net/api/notes", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${"d".repeat(43)}` },
      }),
    );
    expect(ok).toBe(false);
  });
});
