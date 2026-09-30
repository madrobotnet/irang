import { describe, expect, test } from "bun:test";
import {
  exchangeOpenRouterCode,
  OAuthProtocolError,
  refreshCredential,
  startDeviceAuthorization,
} from "./protocol";

type CapturedRequest = {
  readonly url: string;
  readonly headers: Headers;
  readonly body: string;
};

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

function captureFetch(response: Response): {
  readonly fetchImpl: typeof fetch;
  readonly requests: readonly CapturedRequest[];
} {
  const requests: CapturedRequest[] = [];
  const fetchImpl: typeof fetch = Object.assign(
    async (url: RequestInfo | URL, init?: RequestInit) => {
      requests.push({
        url: String(url),
        headers: new Headers(init?.headers),
        body: String(init?.body ?? ""),
      });
      return response;
    },
    { preconnect: fetch.preconnect },
  );
  return { fetchImpl, requests };
}

describe("credential refresh", () => {
  test("retains an xAI refresh token when the provider omits rotation", async () => {
    const fixture = captureFetch(jsonResponse({
      access_token: "next-access",
      expires_in: 120,
    }));

    const credential = await refreshCredential({
      provider: "xai",
      accessToken: "old-access",
      refreshToken: "retained-refresh",
      expiresAt: 1,
    }, {
      fetchImpl: fixture.fetchImpl,
      now: () => 5_000,
    });

    expect(credential).toEqual({
      provider: "xai",
      accessToken: "next-access",
      refreshToken: "retained-refresh",
      expiresAt: 125_000,
    });
    expect(fixture.requests[0]?.url).toBe("https://auth.x.ai/oauth2/token");
    const body = new URLSearchParams(fixture.requests[0]?.body);
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("retained-refresh");
  });

  test("stores an xAI refresh token when the provider rotates it", async () => {
    const fixture = captureFetch(jsonResponse({
      access_token: "next-access",
      refresh_token: "rotated-refresh",
      expires_in: 60,
    }));

    const credential = await refreshCredential({
      provider: "xai",
      accessToken: "old-access",
      refreshToken: "old-refresh",
    }, {
      fetchImpl: fixture.fetchImpl,
      now: () => 10_000,
    });

    expect(credential).toEqual({
      provider: "xai",
      accessToken: "next-access",
      refreshToken: "rotated-refresh",
      expiresAt: 70_000,
    });
  });

  test("re-exchanges GitHub's retained token without subtracting refresh skew", async () => {
    const fixture = captureFetch(jsonResponse({
      token: "new-copilot-token",
      expires_at: 3_000,
    }));

    const credential = await refreshCredential({
      provider: "github-copilot",
      accessToken: "old-copilot-token",
      refreshToken: "github-token",
      enterpriseDomain: "ghe.example.test",
    }, { fetchImpl: fixture.fetchImpl });

    expect(credential).toEqual({
      provider: "github-copilot",
      accessToken: "new-copilot-token",
      refreshToken: "github-token",
      expiresAt: 3_000_000,
      baseUrl: "https://copilot-api.ghe.example.test",
      enterpriseDomain: "ghe.example.test",
    });
    expect(fixture.requests[0]?.url)
      .toBe("https://api.ghe.example.test/copilot_internal/v2/token");
  });
});

describe("OpenRouter key exchange", () => {
  test("posts the PKCE verifier to the fixed endpoint", async () => {
    const fixture = captureFetch(jsonResponse({ key: "openrouter-durable-key" }));

    const credential = await exchangeOpenRouterCode({
      code: "authorization-code",
      verifier: "v".repeat(43),
    }, { fetchImpl: fixture.fetchImpl });

    expect(credential).toEqual({
      provider: "openrouter",
      accessToken: "openrouter-durable-key",
    });
    expect(fixture.requests[0]?.url).toBe("https://openrouter.ai/api/v1/auth/keys");
    expect(fixture.requests[0]?.headers.get("content-type")).toBe("application/json");
    expect(JSON.parse(fixture.requests[0]?.body ?? "{}")).toEqual({
      code: "authorization-code",
      code_verifier: "v".repeat(43),
      code_challenge_method: "S256",
    });
  });
});

describe("OAuth failures", () => {
  test("sanitizes provider error bodies while retaining a safe error code", async () => {
    const fixture = captureFetch(jsonResponse({
      error: "invalid_grant",
      error_description: "leaked-secret-token",
      key: "leaked-key",
    }, 401));

    const result = await exchangeOpenRouterCode({
      code: "authorization-code",
      verifier: "v".repeat(43),
    }, { fetchImpl: fixture.fetchImpl }).catch((error: unknown) => error);

    expect(result).toBeInstanceOf(OAuthProtocolError);
    if (!(result instanceof OAuthProtocolError)) throw result;
    expect(result).toMatchObject({
      provider: "openrouter",
      operation: "key exchange",
      status: 401,
      code: "invalid_grant",
    });
    expect(result.message).not.toContain("leaked-secret-token");
    expect(result.message).not.toContain("leaked-key");
  });

  test("reports malformed responses without exposing their body", async () => {
    const fixture = captureFetch(new Response("raw-secret-token", { status: 502 }));

    const result = await startDeviceAuthorization("xai", {
      fetchImpl: fixture.fetchImpl,
    }).catch((error: unknown) => error);

    expect(result).toBeInstanceOf(OAuthProtocolError);
    if (!(result instanceof OAuthProtocolError)) throw result;
    expect(result.status).toBe(502);
    expect(result.message).not.toContain("raw-secret-token");
  });

  test("propagates abort before making an upstream request", async () => {
    let requests = 0;
    const fetchImpl: typeof fetch = Object.assign(
      async () => {
        requests += 1;
        return jsonResponse({});
      },
      { preconnect: fetch.preconnect },
    );
    const controller = new AbortController();
    const reason = new DOMException("cancelled by test", "AbortError");
    controller.abort(reason);

    const result = await startDeviceAuthorization("xai", {
      fetchImpl,
      signal: controller.signal,
    }).catch((error: unknown) => error);

    expect(result).toBe(reason);
    expect(requests).toBe(0);
  });
});
