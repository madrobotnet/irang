import { afterAll, beforeEach, expect, test } from "bun:test";
import { query, tx } from "@/server/db";
import { saveConnectionProfile } from "@/server/setup/ai-profiles";
import { aiSettingsView } from "@/server/setup/settings";
import { closeDb, connectTestDatabase, resetData } from "@/server/test/db";
import { consumeAuthAttempt, type AiAuthScope } from "./attempt-store";
import { submitAuthCode } from "./code";
import { cancelAuthAttempt, pollAuthAttempt } from "./poll";
import { startAuthAttempt } from "./start";

connectTestDatabase();
let scope: AiAuthScope;
let clock: number;
beforeEach(async () => {
  await resetData();
  const [owner] = await query<{ id: string }>("INSERT INTO users (password_hash) VALUES ('fixture') RETURNING id");
  if (!owner) throw new Error("Missing owner");
  scope = { key: `owner:${owner.id}`, browserHash: "a".repeat(64) };
  clock = Date.now();
});
afterAll(closeDb);

const device = () => Response.json({ device_auth_id: "private-device", user_code: "REAL-CODE", interval: "5" });
const code = () => Response.json({ authorization_code: "private-code", code_verifier: "private-verifier", code_challenge: "challenge" });
const tokens = () => Response.json({ access_token: "private-access", refresh_token: "private-refresh", expires_in: 3600,
  id_token: `e30.${Buffer.from(JSON.stringify({ "https://api.openai.com/auth": { chatgpt_account_id: "private-account" } })).toString("base64url")}.fixture` });
function wire(...responses: (Response | Error)[]) {
  const requests: { url: string; body: string }[] = [];
  const fetchImpl: typeof fetch = Object.assign(async (url: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(url), body: String(init?.body ?? "") });
    const response = responses.shift();
    if (response instanceof Error) throw response;
    if (!response) throw new Error("Unexpected upstream request");
    return response;
  }, { preconnect: fetch.preconnect });
  return { requests, options: { fetchImpl, now: () => clock } };
}

for (const provider of ["openai", "google"] as const) {
  test(`${provider} is browser/owner scoped, consumed transactionally, and saved without token disclosure`, async () => {
    // Given
    const upstream = wire(...(provider === "openai" ? [device(), code(), tokens()] : [tokens()]));
    const started = await startAuthAttempt({ provider, callbackOrigin: "https://brain.example" }, scope, upstream.options);
    expect(started).toMatchObject({ status: "pending", ...(provider === "google" ? { requiresCode: true } : { userCode: "REAL-CODE" }) });
    for (const wrong of [{ ...scope, browserHash: "other" }, { ...scope, key: "owner:other" }, { key: scope.key }]) {
      await expect(pollAuthAttempt(started.id, wrong, upstream.options)).rejects.toMatchObject({ code: "forbidden" });
      await expect(cancelAuthAttempt(started.id, wrong)).rejects.toMatchObject({ code: "forbidden" });
      if (provider === "google") await expect(submitAuthCode({ id: started.id, code: "4/code" }, wrong, upstream.options)).rejects.toMatchObject({ code: "forbidden" });
    }
    // When
    clock += 5000;
    const ready = provider === "google" ? await submitAuthCode({ id: started.id, code: "4/code" }, scope, upstream.options)
      : await pollAuthAttempt(started.id, scope, upstream.options);
    expect(ready.status).toBe("ready");
    expect(JSON.stringify(ready)).not.toContain("private-");
    await expect(tx(async (client) => {
      await consumeAuthAttempt(client, { id: started.id, provider, scope });
      throw new Error("rollback");
    })).rejects.toThrow("rollback");
    const input = { purpose: "chat", name: "Browser profile", consent: true,
      connection: { mode: "auth", provider, model: "fixture", authAttemptId: started.id } } as const;
    const saved = await saveConnectionProfile(input, { browserHash: scope.browserHash });
    // Then
    expect(saved.connection).toMatchObject({ credential: { provider, accessToken: "private-access", refreshToken: "private-refresh" } });
    expect(JSON.stringify(await aiSettingsView())).not.toContain("private-");
    await expect(saveConnectionProfile(input, { browserHash: scope.browserHash })).rejects.toMatchObject({ code: "forbidden" });
    const edited = await saveConnectionProfile({ ...input, name: "Renamed", connection: { mode: "auth", provider, model: "edited-model" } }, { id: saved.id });
    expect(edited.connection).toMatchObject({ model: "edited-model", credential: { accessToken: "private-access" } });
  });

  test(`${provider} expires before exchange and cancels without contacting the provider`, async () => {
    // Given
    const upstream = wire(...(provider === "openai" ? [device(), device()] : []));
    const first = await startAuthAttempt({ provider, callbackOrigin: "https://brain.example" }, scope, upstream.options);
    const second = await startAuthAttempt({ provider, callbackOrigin: "https://brain.example" }, scope, upstream.options);
    const calls = upstream.requests.length;
    // When
    await cancelAuthAttempt(first.id, scope);
    clock = second.expiresAt;
    const expired = provider === "google" ? await submitAuthCode({ id: second.id, code: "4/code" }, scope, upstream.options)
      : await pollAuthAttempt(second.id, scope, upstream.options);
    // Then
    expect(expired.status).toBe("expired");
    expect(upstream.requests).toHaveLength(calls);
    await expect(pollAuthAttempt(first.id, scope, upstream.options)).rejects.toMatchObject({ code: "not_found" });
    expect((await query<{ payload: unknown }>("SELECT payload FROM ai_auth_attempts WHERE id = $1", [second.id]))[0]?.payload).toEqual({});
  });

  test(`${provider} retries explicit transient exchange responses without losing the prepared grant`, async () => {
    // Given
    const upstream = wire(...(provider === "openai" ? [device(), code()] : []),
      new Response("gateway", { status: 503 }), Response.json({ error: "rate_limit" }, { status: 429 }), tokens());
    const started = await startAuthAttempt({ provider, callbackOrigin: "https://brain.example" }, scope, upstream.options);
    clock += 5000;
    // When
    const first = provider === "google" ? await submitAuthCode({ id: started.id, code: "4/code" }, scope, upstream.options)
      : await pollAuthAttempt(started.id, scope, upstream.options);
    expect(first.status).toBe("pending");
    expect(JSON.stringify(first)).not.toContain("private-");
    const calls = upstream.requests.length;
    await pollAuthAttempt(started.id, scope, upstream.options);
    expect(upstream.requests).toHaveLength(calls);
    clock += first.retryAfterMs ?? 0;
    const second = await pollAuthAttempt(started.id, scope, upstream.options);
    clock += second.retryAfterMs ?? 0;
    const ready = await pollAuthAttempt(started.id, scope, upstream.options);
    // Then
    expect(ready.status).toBe("ready");
    const exchanges = upstream.requests.filter((request) => request.url.endsWith("/token") && !request.url.includes("deviceauth"));
    expect(exchanges).toHaveLength(3);
    expect(new Set(exchanges.map((request) => request.body)).size).toBe(1);
    if (provider === "openai") expect(upstream.requests.filter((request) => request.url.includes("deviceauth/token"))).toHaveLength(1);
    else expect(first.requiresCode).toBe(false);
  });

  test(`${provider} does not replay an ambiguous one-time token POST`, async () => {
    // Given
    const upstream = wire(...(provider === "openai" ? [device(), code()] : []), new DOMException("response timeout", "TimeoutError"));
    const started = await startAuthAttempt({ provider, callbackOrigin: "https://brain.example" }, scope, upstream.options);
    clock += 5000;
    // When
    const failed = provider === "google" ? await submitAuthCode({ id: started.id, code: "4/code" }, scope, upstream.options)
      : await pollAuthAttempt(started.id, scope, upstream.options);
    const calls = upstream.requests.length;
    clock += 60_000;
    const repeated = await pollAuthAttempt(started.id, scope, upstream.options);
    // Then
    expect(failed.status).toBe("failed");
    expect(repeated.status).toBe("failed");
    expect(upstream.requests).toHaveLength(calls);
    expect((await query<{ payload: unknown }>("SELECT payload FROM ai_auth_attempts WHERE id = $1", [started.id]))[0]?.payload).toEqual({});
  });

  test(`${provider} requires browser login for new profiles but preserves legacy file-backed edits`, async () => {
    // Given
    const input = { purpose: "chat", name: "Legacy", consent: true, connection: { mode: "auth", provider, model: "old" } } as const;
    await expect(saveConnectionProfile(input)).rejects.toMatchObject({ code: "validation" });
    const [legacy] = await query<{ id: string }>(`INSERT INTO ai_connections (owner_id, purpose, name, connection)
      VALUES ((SELECT id FROM users LIMIT 1), 'chat', 'Legacy', $1::jsonb) RETURNING id`, [JSON.stringify(input.connection)]);
    if (!legacy) throw new Error("Missing legacy profile");
    // When
    const edited = await saveConnectionProfile({ ...input, connection: { ...input.connection, model: "new" } }, { id: legacy.id });
    // Then
    expect(edited.connection).toEqual({ mode: "auth", provider, model: "new" });
  });
}
