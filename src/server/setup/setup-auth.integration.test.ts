import { afterAll, afterEach, beforeEach, expect, test } from "bun:test";
import type { AiSettingsInput } from "@/lib/ai-settings";
import { GET as openRouterCallback } from "@/app/api/ai/auth/openrouter/callback/[id]/route";
import { AI_AUTH_COOKIE, authBrowserIdentity } from "@/server/ai-auth/access";
import { finishOpenRouterAuth } from "@/server/ai-auth/callback";
import { pollAuthAttempt } from "@/server/ai-auth/poll";
import { startAuthAttempt } from "@/server/ai-auth/start";
import { query } from "@/server/db";
import { closeDb, connectTestDatabase, resetData } from "@/server/test/db";
import { requireInstallerAccess } from "./access";
import { completeSetup, setupState } from "./service";
import { storedAiSettings } from "./settings";

connectTestDatabase();
const token = "setup-browser-auth-fixture-token-with-enough-characters";
const environment = { SETUP_TOKEN: process.env.SETUP_TOKEN, AUTH_PASSWORD_HASH: process.env.AUTH_PASSWORD_HASH };
beforeEach(async () => {
  await resetData();
  process.env.SETUP_TOKEN = token;
  delete process.env.AUTH_PASSWORD_HASH;
});
afterEach(() => {
  for (const [key, value] of Object.entries(environment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
afterAll(closeDb);

test("callback checks the browser cookie and redirects within the public origin", async () => {
  const cookie = `${AI_AUTH_COOKIE}=${"a".repeat(64)}`;
  const browser = authBrowserIdentity(new Request("https://brain.example", { headers: { cookie } }));
  const scope = { key: await requireInstallerAccess(token), browserHash: browser.hash };
  const started = await startAuthAttempt({ provider: "openrouter", callbackOrigin: "https://brain.example" }, scope);
  const url = `http://localhost:3000/api/ai/auth/openrouter/callback/${started.id}?error=access_denied`;
  const context = { params: Promise.resolve({ id: started.id }) };
  for (const invalidCookie of ["", `${AI_AUTH_COOKIE}=malformed`, `${AI_AUTH_COOKIE}=${"b".repeat(64)}`]) {
    const denied = await openRouterCallback(new Request(url, {
      headers: { host: "brain.example", cookie: invalidCookie },
    }), context);
    expect(denied.status).toBe(403);
  }
  expect((await pollAuthAttempt(started.id, scope)).status).toBe("pending");
  const response = await openRouterCallback(new Request(url, {
    headers: { host: "brain.example", cookie },
  }), context);
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe("/connect/complete?status=failed&stage=setup");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect((await pollAuthAttempt(started.id, scope)).status).toBe("denied");
});

test("consumes installer-bound login with owner creation and rolls back the whole failed setup", async () => {
  const scope = { key: await requireInstallerAccess(token), browserHash: "b".repeat(64) };
  const started = await startAuthAttempt({ provider: "openrouter", callbackOrigin: "https://brain.example" }, scope);
  const fetchImpl: typeof fetch = Object.assign(async () => Response.json({ key: "setup-router-secret" }), {
    preconnect: fetch.preconnect,
  });
  await finishOpenRouterAuth({ id: started.id, code: "fixture-code", browserHash: scope.browserHash }, { fetchImpl });
  const ai: AiSettingsInput = {
    chat: { mode: "auth", provider: "openrouter", model: "fixture-model", authAttemptId: started.id },
    chatConsent: true, jev: null, jevConsent: false,
  };
  await expect(completeSetup({
    setupToken: token, password: "fixture-long-password",
    ai: { ...ai, jev: { provider: "typesafe", model: "jev-latest" }, jevConsent: true },
  }, { browserHash: scope.browserHash })).rejects.toMatchObject({ code: "validation" });
  expect(await setupState()).toBe("ready");
  expect((await pollAuthAttempt(started.id, scope)).status).toBe("ready");
  expect(await query("SELECT id FROM ai_connections")).toHaveLength(0);
  await completeSetup({ setupToken: token, password: "fixture-long-password", ai }, { browserHash: scope.browserHash });
  expect(await setupState()).toBe("complete");
  expect((await storedAiSettings())?.chat).toMatchObject({
    mode: "auth", provider: "openrouter", credential: { accessToken: "setup-router-secret" },
  });
  expect(await query("SELECT id FROM ai_auth_attempts")).toHaveLength(0);
});
