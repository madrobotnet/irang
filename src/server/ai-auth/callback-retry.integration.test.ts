import { afterAll, beforeEach, expect, test } from "bun:test";
import { GET as callbackRoute } from "@/app/api/ai/auth/openrouter/callback/[id]/route";
import { query } from "@/server/db";
import { closeDb, connectTestDatabase, resetData } from "@/server/test/db";
import { AI_AUTH_COOKIE, authBrowserIdentity } from "./access";
import type { AiAuthScope } from "./attempt-store";
import { finishOpenRouterAuth } from "./callback";
import { cancelAuthAttempt, pollAuthAttempt } from "./poll";
import { startAuthAttempt } from "./start";

connectTestDatabase();
const cookie = `${AI_AUTH_COOKIE}=${"d".repeat(64)}`;
let scope: AiAuthScope;
let clock: number;
beforeEach(async () => {
  await resetData();
  const [owner] = await query<{ id: string }>("INSERT INTO users (password_hash) VALUES ('fixture-hash') RETURNING id");
  if (!owner) throw new Error("Owner fixture was not created");
  const browser = authBrowserIdentity(new Request("http://localhost", { headers: { cookie } }));
  scope = { key: `owner:${owner.id}`, browserHash: browser.hash };
  clock = Date.now();
});
afterAll(closeDb);

function wire(...responses: readonly (Response | Error)[]) {
  const bodies: string[] = [];
  const fetchImpl: typeof fetch = Object.assign(async (_url: RequestInfo | URL, init?: RequestInit) => {
    const response = responses[bodies.length];
    bodies.push(String(init?.body));
    if (!response) throw new Error("Unexpected exchange");
    if (response instanceof Error) throw response;
    return response;
  }, { preconnect: fetch.preconnect });
  return { bodies, options: { fetchImpl, now: () => clock } };
}

for (const failure of [
  { name: "gateway HTML", response: () => new Response("unavailable", { status: 503 }) },
  { name: "rate limit", response: () => Response.json({ error: "rate_limited" }, { status: 429 }) },
  { name: "network failure", response: () => new TypeError("connection closed") },
]) {
  test(`OpenRouter retries ${failure.name} with the original PKCE code and verifier`, async () => {
    const upstream = wire(failure.response(), Response.json({ key: "private-router-key" }));
    const started = await startAuthAttempt({ provider: "openrouter", callbackOrigin: "http://localhost" }, scope, upstream.options);
    const [before] = await query<{ payload: { verifier: string } }>("SELECT payload FROM ai_auth_attempts WHERE id=$1", [started.id]);
    if (!before) throw new Error("Missing PKCE attempt");

    const callback = await finishOpenRouterAuth({ id: started.id, code: "private-code", browserHash: scope.browserHash }, upstream.options);

    expect(callback).toMatchObject({ success: false, pending: true, setup: false });
    const pending = await pollAuthAttempt(started.id, scope, upstream.options);
    expect(pending).toMatchObject({ status: "pending", retryAfterMs: 5000 });
    expect(JSON.stringify(pending)).not.toContain("private-");
    expect(JSON.stringify(pending)).not.toContain(before.payload.verifier);
    expect(upstream.bodies).toHaveLength(1);
    clock += 5000;
    const results = await Promise.all([
      pollAuthAttempt(started.id, scope, upstream.options),
      pollAuthAttempt(started.id, scope, upstream.options),
    ]);
    expect(results.map(result => result.status)).toEqual(["ready", "ready"]);
    expect(upstream.bodies).toHaveLength(2);
    expect(upstream.bodies[1]).toBe(upstream.bodies[0]);
    expect(JSON.parse(upstream.bodies[1] ?? "")).toMatchObject({
      code: "private-code", code_verifier: before.payload.verifier,
    });
    expect(JSON.stringify(results)).not.toContain("private-router-key");
  });
}

test("an accepted retryable callback cannot be replayed or replaced", async () => {
  const upstream = wire(new Response("unavailable", { status: 503 }));
  const started = await startAuthAttempt({ provider: "openrouter", callbackOrigin: "http://localhost" }, scope, upstream.options);
  await finishOpenRouterAuth({ id: started.id, code: "private-code", browserHash: scope.browserHash }, upstream.options);

  await expect(finishOpenRouterAuth({ id: started.id, code: "other-code", browserHash: scope.browserHash }, upstream.options))
    .rejects.toMatchObject({ code: "conflict" });

  const [stored] = await query<{ payload: unknown }>("SELECT payload FROM ai_auth_attempts WHERE id=$1", [started.id]);
  expect(stored?.payload).toMatchObject({ code: "private-code" });
  expect(upstream.bodies).toHaveLength(1);
});

test("a permanent OpenRouter exchange failure clears pending secrets", async () => {
  const upstream = wire(Response.json({ error: "invalid_grant" }, { status: 400 }));
  const started = await startAuthAttempt({ provider: "openrouter", callbackOrigin: "http://localhost" }, scope, upstream.options);

  expect(await finishOpenRouterAuth({ id: started.id, code: "private-code", browserHash: scope.browserHash }, upstream.options))
    .toEqual({ success: false, setup: false });

  expect((await pollAuthAttempt(started.id, scope, upstream.options)).status).toBe("failed");
  const [stored] = await query<{ payload: unknown }>("SELECT payload FROM ai_auth_attempts WHERE id=$1", [started.id]);
  expect(stored?.payload).toEqual({});
});

for (const end of ["expiry", "cancellation"] as const) {
  test(`OpenRouter retry secrets are removed on ${end}`, async () => {
    const upstream = wire(new Response("unavailable", { status: 503 }));
    const started = await startAuthAttempt({ provider: "openrouter", callbackOrigin: "http://localhost" }, scope, upstream.options);
    expect(await finishOpenRouterAuth({ id: started.id, code: "private-code", browserHash: scope.browserHash }, upstream.options))
      .toMatchObject({ pending: true });

    if (end === "expiry") {
      clock = started.expiresAt;
      expect((await pollAuthAttempt(started.id, scope, upstream.options)).status).toBe("expired");
      const [stored] = await query<{ payload: unknown }>("SELECT payload FROM ai_auth_attempts WHERE id=$1", [started.id]);
      expect(stored?.payload).toEqual({});
    } else {
      await cancelAuthAttempt(started.id, scope);
      await expect(pollAuthAttempt(started.id, scope, upstream.options)).rejects.toMatchObject({ code: "not_found" });
    }
    expect(upstream.bodies).toHaveLength(1);
  });
}

test("the retryable callback redirects without putting the code in the completion URL", async () => {
  const upstream = wire(new Response("unavailable", { status: 503 }));
  const started = await startAuthAttempt({ provider: "openrouter", callbackOrigin: "http://localhost" }, scope, upstream.options);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = upstream.options.fetchImpl;
  try {
    const response = await callbackRoute(new Request(
      `http://localhost/api/ai/auth/openrouter/callback/${started.id}?code=private-code`,
      { headers: { cookie } },
    ), { params: Promise.resolve({ id: started.id }) });

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/connect/complete?status=pending&stage=settings");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
