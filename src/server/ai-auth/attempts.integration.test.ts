import { afterAll, beforeEach, expect, test } from "bun:test";
import { query, tx } from "@/server/db";
import { closeDb, connectTestDatabase, resetData } from "@/server/test/db";
import { saveConnectionProfile } from "@/server/setup/ai-profiles";
import { aiSettingsView } from "@/server/setup/settings";
import { consumeAuthAttempt, type AiAuthScope } from "./attempt-store";
import { finishOpenRouterAuth } from "./callback";
import { cancelAuthAttempt, pollAuthAttempt } from "./poll";
import { refreshedConnectionProfile } from "./refresh";
import { startAuthAttempt } from "./start";

connectTestDatabase();
let scope: AiAuthScope;
let clock: number;
beforeEach(async () => {
  await resetData();
  const rows = await query<{ id: string }>("INSERT INTO users (password_hash) VALUES ('fixture-hash') RETURNING id");
  const owner = rows[0];
  if (!owner) throw new Error("Owner fixture was not created");
  scope = { key: `owner:${owner.id}`, browserHash: "a".repeat(64) };
  clock = Date.now();
});
afterAll(closeDb);

function fixture(...bodies: readonly unknown[]) {
  const requests: Array<{ url: string; init: RequestInit | undefined }> = [];
  const fetchImpl: typeof fetch = Object.assign(async (url: RequestInfo | URL, init?: RequestInit) => {
    const body = bodies[requests.length];
    if (body === undefined) throw new Error("Unexpected upstream request");
    requests.push({ url: String(url), init });
    return Response.json(body, {
      status: typeof body === "object" && body !== null && "error" in body ? 400 : 200,
    });
  }, { preconnect: fetch.preconnect });
  return { requests, options: { fetchImpl, now: () => clock } };
}

const device = {
  device_code: "private-device-code", user_code: "USER-CODE",
  verification_uri: "https://auth.x.ai/activate", interval: 5, expires_in: 900,
};

test("enforces provider intervals and slow_down without leaking device credentials", async () => {
  const wire = fixture(device, { error: "slow_down" }, {
    access_token: "private-access", refresh_token: "private-refresh", expires_in: 3600,
  });
  const started = await startAuthAttempt({ provider: "xai", callbackOrigin: "http://localhost" }, scope, wire.options);
  expect(started.status).toBe("pending");
  expect(JSON.stringify(started)).not.toContain("private-device");
  expect((await pollAuthAttempt(started.id, scope, wire.options)).retryAfterMs).toBe(5000);
  expect(wire.requests).toHaveLength(1);
  clock += 5000;
  expect((await pollAuthAttempt(started.id, scope, wire.options)).retryAfterMs).toBe(10000);
  expect(wire.requests).toHaveLength(2);
  clock += 9999;
  await pollAuthAttempt(started.id, scope, wire.options);
  expect(wire.requests).toHaveLength(2);
  clock += 1;
  const ready = await pollAuthAttempt(started.id, scope, wire.options);
  expect(ready.status).toBe("ready");
  expect(JSON.stringify(ready)).not.toContain("private-access");
  expect(JSON.stringify(ready)).not.toContain("private-refresh");
});

test("rejects another owner or browser before polling or cancelling upstream", async () => {
  const wire = fixture(device);
  const started = await startAuthAttempt({ provider: "xai", callbackOrigin: "http://localhost" }, scope, wire.options);
  clock += 5000;
  await expect(pollAuthAttempt(started.id, { ...scope, key: "owner:other" }, wire.options))
    .rejects.toMatchObject({ code: "forbidden" });
  await expect(cancelAuthAttempt(started.id, { ...scope, browserHash: "different-browser" }))
    .rejects.toMatchObject({ code: "forbidden" });
  expect(wire.requests).toHaveLength(1);
  await cancelAuthAttempt(started.id, scope);
  await expect(pollAuthAttempt(started.id, scope, wire.options)).rejects.toMatchObject({ code: "not_found" });
});

test("expires locally without an upstream call and clears the private payload", async () => {
  const wire = fixture(device);
  const started = await startAuthAttempt({ provider: "xai", callbackOrigin: "http://localhost" }, scope, wire.options);
  clock = started.expiresAt;
  expect((await pollAuthAttempt(started.id, scope, wire.options)).status).toBe("expired");
  expect(wire.requests).toHaveLength(1);
  const rows = await query<{ payload: unknown }>("SELECT payload FROM ai_auth_attempts WHERE id = $1", [started.id]);
  expect(rows[0]?.payload).toEqual({});
});

test("records provider denial as a terminal state", async () => {
  const wire = fixture(device, { error: "access_denied" });
  const started = await startAuthAttempt({ provider: "xai", callbackOrigin: "http://localhost" }, scope, wire.options);
  clock += 5000;
  expect((await pollAuthAttempt(started.id, scope, wire.options)).status).toBe("denied");
  await pollAuthAttempt(started.id, scope, wire.options);
  expect(wire.requests).toHaveLength(2);
});

test("binds OpenRouter PKCE callback to the browser and accepts it only once", async () => {
  const wire = fixture({ key: "private-router-key" });
  const started = await startAuthAttempt({ provider: "openrouter", callbackOrigin: "https://brain.example" }, scope, wire.options);
  const authUrl = new URL(started.verificationUrl ?? "");
  expect(authUrl.searchParams.get("callback_url")).toBe(`https://brain.example/api/ai/auth/openrouter/callback/${started.id}`);
  expect(authUrl.searchParams.get("code_challenge_method")).toBe("S256");
  await expect(finishOpenRouterAuth({ id: started.id, code: "code", browserHash: "wrong" }, wire.options))
    .rejects.toMatchObject({ code: "forbidden" });
  expect(wire.requests).toHaveLength(0);
  expect(await finishOpenRouterAuth({ id: started.id, code: "code", browserHash: scope.browserHash }, wire.options))
    .toEqual({ success: true, setup: false });
  await expect(finishOpenRouterAuth({ id: started.id, code: "code", browserHash: scope.browserHash }, wire.options))
    .rejects.toMatchObject({ code: "conflict" });
  expect(wire.requests).toHaveLength(1);
  expect(JSON.stringify(await pollAuthAttempt(started.id, scope, wire.options))).not.toContain("private-router-key");
});

test("rolls back consumption on failed save and consumes a successful Jev connection once", async () => {
  const wire = fixture({ key: "private-router-key" });
  const started = await startAuthAttempt({ provider: "openrouter", callbackOrigin: "https://brain.example" }, scope, wire.options);
  await finishOpenRouterAuth({ id: started.id, code: "code", browserHash: scope.browserHash }, wire.options);
  await expect(tx(async (client) => {
    await consumeAuthAttempt(client, { id: started.id, provider: "openrouter", scope });
    throw new Error("fixture rollback");
  })).rejects.toThrow("fixture rollback");
  expect((await pollAuthAttempt(started.id, scope, wire.options)).status).toBe("ready");
  const input = {
    purpose: "jev", name: "Router account", consent: true,
    connection: { mode: "auth", provider: "openrouter", model: "~typesafe/jev-latest", authAttemptId: started.id },
  } as const;
  const saved = await saveConnectionProfile(input, { browserHash: scope.browserHash });
  expect(saved.connection).toMatchObject({ credential: { provider: "openrouter", accessToken: "private-router-key" } });
  expect(JSON.stringify(await aiSettingsView())).not.toContain("private-router-key");
  await expect(saveConnectionProfile(input, { browserHash: scope.browserHash })).rejects.toMatchObject({ code: "forbidden" });
});

test("serializes concurrent refresh and persists rotation without losing model or name", async () => {
  const wire = fixture(device, {
    access_token: "first-access", refresh_token: "first-refresh", expires_in: 1,
  }, { access_token: "renewed-access", refresh_token: "renewed-refresh", expires_in: 3600 });
  const started = await startAuthAttempt({ provider: "xai", callbackOrigin: "http://localhost" }, scope, wire.options);
  clock += 5000;
  await pollAuthAttempt(started.id, scope, wire.options);
  const saved = await saveConnectionProfile({
    purpose: "chat", name: "X account", consent: true,
    connection: { mode: "auth", provider: "xai", model: "grok-fixture", authAttemptId: started.id },
  }, { browserHash: scope.browserHash });
  const results = await Promise.all([
    refreshedConnectionProfile(saved.id, wire.options), refreshedConnectionProfile(saved.id, wire.options),
  ]);
  expect(wire.requests).toHaveLength(3);
  for (const profile of results) expect(profile).toMatchObject({
    name: "X account",
    connection: { model: "grok-fixture", credential: { accessToken: "renewed-access", refreshToken: "renewed-refresh" } },
  });
  const body = new URLSearchParams(String(wire.requests[2]?.init?.body));
  expect(body.get("refresh_token")).toBe("first-refresh");
});

test("requires completed browser authentication before saving a new Auth profile", async () => {
  await expect(saveConnectionProfile({
    purpose: "chat", name: "unconnected account", consent: true,
    connection: { mode: "auth", provider: "xai", model: "grok-fixture" },
  })).rejects.toMatchObject({ code: "validation" });
  await expect(saveConnectionProfile({
    purpose: "jev", name: "unconnected Jev", consent: true,
    connection: { mode: "auth", provider: "openrouter", model: "~typesafe/jev-latest" },
  })).rejects.toMatchObject({ code: "validation" });
  expect((await aiSettingsView()).profiles).toHaveLength(0);
});

test("limits active attempts but lets a denied login release capacity", async () => {
  const attempts = [];
  for (let index = 0; index < 8; index += 1) {
    attempts.push(await startAuthAttempt({ provider: "openrouter", callbackOrigin: "https://brain.example" }, scope));
  }
  await expect(startAuthAttempt({ provider: "openrouter", callbackOrigin: "https://brain.example" }, scope))
    .rejects.toMatchObject({ code: "rate_limited" });
  const first = attempts[0];
  if (!first) throw new Error("Missing attempt fixture");
  await finishOpenRouterAuth({ id: first.id, denied: true, browserHash: scope.browserHash });
  expect((await startAuthAttempt({ provider: "openrouter", callbackOrigin: "https://brain.example" }, scope)).status).toBe("pending");
});
