import { afterAll, beforeEach, expect, test } from "bun:test";
import { query } from "@/server/db";
import { closeDb, connectTestDatabase, resetData } from "@/server/test/db";
import type { AiAuthScope } from "./attempt-store";
import { pollAuthAttempt } from "./poll";
import { startAuthAttempt } from "./start";

connectTestDatabase();
let scope: AiAuthScope;
let clock: number;
beforeEach(async () => {
  await resetData();
  const [owner] = await query<{ id: string }>("INSERT INTO users (password_hash) VALUES ('fixture-hash') RETURNING id");
  if (!owner) throw new Error("Owner fixture was not created");
  scope = { key: `owner:${owner.id}`, browserHash: "b".repeat(64) };
  clock = Date.now();
});
afterAll(closeDb);

function wire(...responses: readonly (Response | Error)[]) {
  const requests: Array<{ url: string; headers: Headers }> = [];
  const fetchImpl: typeof fetch = Object.assign(async (url: RequestInfo | URL, init?: RequestInit) => {
    const response = responses[requests.length];
    requests.push({ url: String(url), headers: new Headers(init?.headers) });
    if (!response) throw new Error("Unexpected upstream request");
    if (response instanceof Error) throw response;
    return response;
  }, { preconnect: fetch.preconnect });
  return { requests, options: { fetchImpl, now: () => clock } };
}

function deviceResponse(): Response {
  return Response.json({
    device_code: "private-device-code", user_code: "USER-CODE",
    verification_uri: "https://github.com/login/device", interval: 5, expires_in: 900,
  });
}

const failures = [
  { name: "network rejection", response: () => new TypeError("socket closed") },
  { name: "timeout", response: () => new DOMException("timed out", "TimeoutError") },
  { name: "rate limit", response: () => Response.json({ error: "rate_limited" }, { status: 429 }) },
  { name: "gateway HTML", response: () => new Response("upstream unavailable", { status: 503 }) },
  {
    name: "interrupted response body",
    response: () => new Response(new ReadableStream({
      start(controller) { controller.error(new TypeError("socket closed")); },
    })),
  },
] as const;

for (const provider of ["xai", "github-copilot"] as const) {
  for (const failure of failures) {
    test(`${provider} retains a private device grant after ${failure.name}`, async () => {
      const success = provider === "xai"
        ? [Response.json({ access_token: "private-access", refresh_token: "private-refresh", expires_in: 3600 })]
        : [Response.json({ access_token: "private-github" }), Response.json({ token: "private-copilot", expires_at: clock / 1000 + 3600 })];
      const upstream = wire(deviceResponse(), failure.response(), ...success);
      const started = await startAuthAttempt({ provider, callbackOrigin: "http://localhost" }, scope, upstream.options);
      clock += 5000;

      const retry = await pollAuthAttempt(started.id, scope, upstream.options);

      expect(retry).toMatchObject({ id: started.id, status: "pending", retryAfterMs: 10000 });
      expect(JSON.stringify(retry)).not.toContain("private-");
      const [stored] = await query<{ payload: unknown }>("SELECT payload FROM ai_auth_attempts WHERE id = $1", [started.id]);
      expect(stored?.payload).toMatchObject({ deviceCode: "private-device-code", intervalSeconds: 10 });
      clock += 9999;
      await pollAuthAttempt(started.id, scope, upstream.options);
      expect(upstream.requests).toHaveLength(2);
      clock += 1;
      expect((await pollAuthAttempt(started.id, scope, upstream.options)).status).toBe("ready");
    });
  }

  for (const permanent of [
    { name: "invalid client", response: () => Response.json({ error: "invalid_client" }, { status: 401 }) },
    { name: "malformed success", response: () => new Response("not JSON") },
  ]) {
    test(`${provider} clears the grant after ${permanent.name}`, async () => {
      const upstream = wire(deviceResponse(), permanent.response());
      const started = await startAuthAttempt({ provider, callbackOrigin: "http://localhost" }, scope, upstream.options);
      clock += 5000;

      expect((await pollAuthAttempt(started.id, scope, upstream.options)).status).toBe("failed");

      const [stored] = await query<{ payload: unknown }>("SELECT payload FROM ai_auth_attempts WHERE id = $1", [started.id]);
      expect(stored?.payload).toEqual({});
      await pollAuthAttempt(started.id, scope, upstream.options);
      expect(upstream.requests).toHaveLength(2);
    });
  }
}

test("Copilot retries token exchange without redeeming a consumed device grant again", async () => {
  const upstream = wire(
    deviceResponse(),
    Response.json({ access_token: "private-github" }),
    Response.json({ error: "unavailable" }, { status: 503 }),
    Response.json({ error: "rate_limited" }, { status: 429 }),
    Response.json({ token: "private-copilot", expires_at: clock / 1000 + 3600 }),
  );
  const started = await startAuthAttempt({ provider: "github-copilot", callbackOrigin: "http://localhost" }, scope, upstream.options);
  clock += 5000;

  const retry = await pollAuthAttempt(started.id, scope, upstream.options);

  expect(retry).toMatchObject({ status: "pending", retryAfterMs: 10000 });
  expect(JSON.stringify(retry)).not.toContain("private-");
  clock += 10000;
  expect(await pollAuthAttempt(started.id, scope, upstream.options))
    .toMatchObject({ status: "pending", retryAfterMs: 15000 });
  clock += 15000;
  expect((await pollAuthAttempt(started.id, scope, upstream.options)).status).toBe("ready");
  expect(upstream.requests.map((request) => request.url)).toEqual([
    "https://github.com/login/device/code",
    "https://github.com/login/oauth/access_token",
    "https://api.github.com/copilot_internal/v2/token",
    "https://api.github.com/copilot_internal/v2/token",
    "https://api.github.com/copilot_internal/v2/token",
  ]);
  expect(upstream.requests[4]?.headers.get("authorization")).toBe("Bearer private-github");
});

test("an exchange retry still expires and erases the retained GitHub token", async () => {
  const upstream = wire(
    deviceResponse(),
    Response.json({ access_token: "private-github" }),
    Response.json({ error: "unavailable" }, { status: 503 }),
  );
  const started = await startAuthAttempt({ provider: "github-copilot", callbackOrigin: "http://localhost" }, scope, upstream.options);
  clock += 5000;
  expect((await pollAuthAttempt(started.id, scope, upstream.options)).status).toBe("pending");
  clock = started.expiresAt;

  expect((await pollAuthAttempt(started.id, scope, upstream.options)).status).toBe("expired");

  const [stored] = await query<{ payload: unknown }>("SELECT payload FROM ai_auth_attempts WHERE id = $1", [started.id]);
  expect(stored?.payload).toEqual({});
  expect(upstream.requests).toHaveLength(3);
});
