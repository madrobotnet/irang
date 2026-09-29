import { afterAll, beforeEach, expect, test } from "bun:test";
import { query } from "@/server/db";
import { closeDb, connectTestDatabase, resetData } from "@/server/test/db";
import type { AiAuthScope } from "./attempt-store";
import { submitAuthCode } from "./code";
import { cancelAuthAttempt, pollAuthAttempt } from "./poll";
import { startAuthAttempt } from "./start";

connectTestDatabase();
let scope: AiAuthScope;
beforeEach(async () => {
  await resetData();
  const [owner] = await query<{ id: string }>("INSERT INTO users (password_hash) VALUES ('fixture') RETURNING id");
  if (!owner) throw new Error("Missing owner");
  scope = { key: `owner:${owner.id}`, browserHash: "b".repeat(64) };
});
afterAll(closeDb);

async function pendingGoogle() {
  return startAuthAttempt({ provider: "google", callbackOrigin: "https://brain.example" }, scope);
}

test("concurrent polling sees the durable exchange claim, not a second token POST", async () => {
  // Given
  const attempt = await pendingGoogle();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let calls = 0;
  const fetchImpl: typeof fetch = Object.assign(async () => {
    calls += 1;
    entered.resolve();
    await release.promise;
    return Response.json({ access_token: "private-access", refresh_token: "private-refresh", expires_in: 3600 });
  }, { preconnect: fetch.preconnect });
  const timeout = AbortSignal.timeout(3000);
  const boundedEntry = Promise.race([entered.promise, new Promise<never>((_, reject) => timeout.addEventListener("abort", () => reject(timeout.reason), { once: true }))]);
  const submit = submitAuthCode({ id: attempt.id, code: "4/code" }, scope, { fetchImpl });
  try {
    await boundedEntry;
    // When
    const poll = await pollAuthAttempt(attempt.id, scope, { fetchImpl });
    // Then
    expect(poll).toMatchObject({ status: "pending", requiresCode: false });
    expect(calls).toBe(1);
    const [stored] = await query<{ payload: unknown }>("SELECT payload FROM ai_auth_attempts WHERE id = $1", [attempt.id]);
    expect(stored?.payload).toMatchObject({ exchangeState: "in_flight" });
    await expect(submitAuthCode({ id: attempt.id, code: "4/different" }, scope, { fetchImpl })).rejects.toMatchObject({ code: "conflict" });
  } finally { release.resolve(); }
  expect((await submit).status).toBe("ready");
  expect((await submitAuthCode({ id: attempt.id, code: "4/code" }, scope, { fetchImpl })).status).toBe("ready");
  expect(calls).toBe(1);
});

test.each(["cancel", "expire"] as const)("late code completion does not resurrect an attempt after %s", async (action) => {
  // Given
  const attempt = await pendingGoogle();
  let clock = Date.now();
  const fetchImpl: typeof fetch = Object.assign(async () => {
    if (action === "cancel") await cancelAuthAttempt(attempt.id, scope);
    else clock = attempt.expiresAt;
    return Response.json({ access_token: "private-access", refresh_token: "private-refresh", expires_in: 3600 });
  }, { preconnect: fetch.preconnect });
  // When
  const result = submitAuthCode({ id: attempt.id, code: "4/code" }, scope, { fetchImpl, now: () => clock });
  // Then
  if (action === "cancel") await expect(result).rejects.toMatchObject({ code: "not_found" });
  else expect((await result).status).toBe("expired");
  expect(await query("SELECT id FROM ai_auth_attempts WHERE status = 'ready'")).toHaveLength(0);
});

test.each([["access_denied", "denied"], ["invalid_grant", "failed"]] as const)("Google %s clears the code and records %s", async (error, status) => {
  // Given
  const attempt = await pendingGoogle();
  const fetchImpl: typeof fetch = Object.assign(async () => Response.json({ error }, { status: 400 }), { preconnect: fetch.preconnect });
  // When
  const result = await submitAuthCode({ id: attempt.id, code: "4/incorrect" }, scope, { fetchImpl });
  // Then
  expect(result.status).toBe(status);
  expect(JSON.stringify(result)).not.toContain("incorrect");
  expect((await query<{ payload: unknown }>("SELECT payload FROM ai_auth_attempts WHERE id = $1", [attempt.id]))[0]?.payload).toEqual({});
});

test("Google attempts share the active-attempt limit and cancellation frees capacity", async () => {
  // Given
  const attempts = [];
  for (let index = 0; index < 8; index += 1) attempts.push(await pendingGoogle());
  // When / Then
  await expect(pendingGoogle()).rejects.toMatchObject({ code: "rate_limited" });
  const first = attempts[0];
  if (!first) throw new Error("Missing attempt");
  await cancelAuthAttempt(first.id, scope);
  expect((await pendingGoogle()).status).toBe("pending");
});
