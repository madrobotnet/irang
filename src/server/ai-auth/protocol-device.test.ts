import { describe, expect, test } from "bun:test";
import {
  pollDeviceAuthorization,
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

function sequenceFetch(responses: readonly Response[]): {
  readonly fetchImpl: typeof fetch;
  readonly requests: readonly CapturedRequest[];
} {
  let index = 0;
  const requests: CapturedRequest[] = [];
  const fetchImpl: typeof fetch = Object.assign(
    async (url: RequestInfo | URL, init?: RequestInit) => {
      requests.push({
        url: String(url),
        headers: new Headers(init?.headers),
        body: String(init?.body ?? ""),
      });
      const response = responses[index];
      index += 1;
      if (response === undefined) throw new RangeError("No fixture response remains");
      return response;
    },
    { preconnect: fetch.preconnect },
  );
  return { fetchImpl, requests };
}

describe("device authorization starts", () => {
  test("sends GitHub's documented device request and controls expiry time", async () => {
    const fixture = sequenceFetch([jsonResponse({
      device_code: "github-device",
      user_code: "ABCD-EFGH",
      verification_uri: "https://github.com/login/device",
      interval: 7,
      expires_in: 900,
    })]);

    const authorization = await startDeviceAuthorization("github-copilot", {
      fetchImpl: fixture.fetchImpl,
      now: () => 1_000,
    });

    expect(authorization).toEqual({
      deviceCode: "github-device",
      userCode: "ABCD-EFGH",
      verificationUrl: "https://github.com/login/device",
      intervalSeconds: 7,
      expiresAt: 901_000,
    });
    expect(fixture.requests[0]?.url).toBe("https://github.com/login/device/code");
    expect(fixture.requests[0]?.headers.get("accept")).toBe("application/json");
    expect(fixture.requests[0]?.headers.get("content-type")).toBe(
      "application/x-www-form-urlencoded",
    );
    expect(new URLSearchParams(fixture.requests[0]?.body).get("client_id"))
      .toBe("Iv1.b507a08c87ecfe98");
  });

  test("exercises xAI's fixed endpoint and form through a local HTTP fixture", async () => {
    const requests: Array<{ readonly headers: Headers; readonly body: string }> = [];
    const server = Bun.serve({
      port: 0,
      async fetch(request) {
        requests.push({
          headers: request.headers,
          body: await request.text(),
        });
        return jsonResponse({
          device_code: "xai-device",
          user_code: "XAI-CODE",
          verification_uri: "https://auth.x.ai/activate",
          verification_uri_complete: "https://auth.x.ai/activate?user_code=XAI-CODE",
          interval: 0,
          expires_in: 600,
        });
      },
    });
    const upstreamUrls: string[] = [];
    const fetchImpl: typeof fetch = Object.assign(
      async (url: RequestInfo | URL, init?: RequestInit) => {
        upstreamUrls.push(String(url));
        return fetch(server.url, init);
      },
      { preconnect: fetch.preconnect },
    );

    try {
      const authorization = await startDeviceAuthorization("xai", {
        fetchImpl,
        now: () => 2_000,
      });

      expect(authorization).toEqual({
        deviceCode: "xai-device",
        userCode: "XAI-CODE",
        verificationUrl: "https://auth.x.ai/activate?user_code=XAI-CODE",
        intervalSeconds: 5,
        expiresAt: 602_000,
      });
      expect(upstreamUrls).toEqual(["https://auth.x.ai/oauth2/device/code"]);
      expect(requests[0]?.headers.get("content-type")).toContain(
        "application/x-www-form-urlencoded",
      );
      const body = new URLSearchParams(requests[0]?.body);
      expect(body.get("client_id")).toBe("b1a00492-073a-47ea-816f-4c329264a828");
      expect(body.get("scope")).toBe(
        "openid profile email offline_access grok-cli:access api:access",
      );
      expect(body.get("referrer")).toBe("pi");
    } finally {
      await server.stop(true);
    }
  });
});

const POLL_CASES = [
  {
    name: "pending",
    response: { error: "authorization_pending" },
    expected: { status: "pending" },
  },
  {
    name: "slow_down",
    response: { error: "slow_down", interval: 11 },
    expected: { status: "slow_down", intervalSeconds: 11 },
  },
  {
    name: "denied",
    response: { error: "access_denied" },
    expected: { status: "denied" },
  },
  {
    name: "expired",
    response: { error: "expired_token" },
    expected: { status: "expired" },
  },
] as const;

describe("single device authorization polls", () => {
  for (const testCase of POLL_CASES) {
    test(`returns ${testCase.name} without retrying`, async () => {
      const fixture = sequenceFetch([jsonResponse(testCase.response, 400)]);

      const result = await pollDeviceAuthorization("xai", "device-code", {
        fetchImpl: fixture.fetchImpl,
      });

      expect(result).toEqual(testCase.expected);
      expect(fixture.requests).toHaveLength(1);
    });
  }

  test("exchanges a successful GitHub device token for Copilot credentials", async () => {
    const fixture = sequenceFetch([
      jsonResponse({ access_token: "github-refresh-token" }),
      jsonResponse({
        token: "tid=1;proxy-ep=proxy.business.githubcopilot.com;sig=secret",
        expires_at: 2_000,
      }),
    ]);

    const result = await pollDeviceAuthorization("github-copilot", "device-code", {
      fetchImpl: fixture.fetchImpl,
    });

    expect(result).toEqual({
      status: "complete",
      credential: {
        provider: "github-copilot",
        accessToken: "tid=1;proxy-ep=proxy.business.githubcopilot.com;sig=secret",
        refreshToken: "github-refresh-token",
        expiresAt: 2_000_000,
        baseUrl: "https://api.business.githubcopilot.com",
      },
    });
    expect(fixture.requests.map((request) => request.url)).toEqual([
      "https://github.com/login/oauth/access_token",
      "https://api.github.com/copilot_internal/v2/token",
    ]);
    expect(fixture.requests[1]?.headers.get("authorization"))
      .toBe("Bearer github-refresh-token");
    expect(fixture.requests[1]?.headers.get("editor-version")).toBe("vscode/1.107.0");
    expect(fixture.requests[1]?.headers.get("copilot-integration-id")).toBe("vscode-chat");
  });

  test("returns xAI credentials with the actual provider expiry", async () => {
    const fixture = sequenceFetch([jsonResponse({
      access_token: "xai-access",
      refresh_token: "xai-refresh",
      expires_in: 3600,
    })]);

    const result = await pollDeviceAuthorization("xai", "device-code", {
      fetchImpl: fixture.fetchImpl,
      now: () => 10_000,
    });

    expect(result).toEqual({
      status: "complete",
      credential: {
        provider: "xai",
        accessToken: "xai-access",
        refreshToken: "xai-refresh",
        expiresAt: 3_610_000,
      },
    });
    expect(fixture.requests).toHaveLength(1);
    expect(fixture.requests[0]?.url).toBe("https://auth.x.ai/oauth2/token");
    expect(new URLSearchParams(fixture.requests[0]?.body).get("grant_type"))
      .toBe("urn:ietf:params:oauth:grant-type:device_code");
  });
});
