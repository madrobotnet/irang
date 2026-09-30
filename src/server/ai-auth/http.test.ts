import { expect, test } from "bun:test";
import { OAuthProtocolError, requestJson } from "./http";

test("rejects oversized OAuth responses before accepting credentials", async () => {
  const fetchImpl: typeof fetch = Object.assign(async () => Response.json({
    access_token: "fixture-token", padding: "x".repeat(65_536),
  }), { preconnect: fetch.preconnect });
  await expect(requestJson({
    provider: "xai", operation: "token", url: "https://auth.x.ai/oauth2/token",
    init: { method: "POST" }, fetchImpl,
  })).rejects.toBeInstanceOf(OAuthProtocolError);
});

test("refuses credential-bearing HTTP redirects on the actual transport", async () => {
  let destinationRequests = 0;
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      if (new URL(request.url).pathname === "/destination") {
        destinationRequests += 1;
        return Response.json({ key: "should-not-reach" });
      }
      return new Response(null, { status: 307, headers: { location: "/destination" } });
    },
  });
  try {
    await expect(requestJson({
      provider: "openrouter", operation: "token", url: server.url.href,
      init: { method: "POST", headers: { authorization: "Bearer fixture-secret" } },
    })).rejects.toBeInstanceOf(OAuthProtocolError);
    expect(destinationRequests).toBe(0);
  } finally {
    await server.stop(true);
  }
});
