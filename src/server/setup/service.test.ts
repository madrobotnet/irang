import { afterAll, afterEach, beforeEach, expect, test } from "bun:test";
import argon2 from "argon2";
import type { AiSettingsInput } from "@/lib/ai-settings";
import { query } from "@/server/db";
import { getJev } from "@/server/jev/client";
import { closeDb, connectTestDatabase, resetData } from "@/server/test/db";
import { aiSettingsView, saveAiSettings, storedAiSettings } from "./settings";
import { completeSetup, loginPasswordHash, setupState, SetupInputSchema } from "./service";

connectTestDatabase();
const environment = {
  AUTH_PASSWORD_HASH: process.env.AUTH_PASSWORD_HASH,
  SETUP_TOKEN: process.env.SETUP_TOKEN,
  TYPESAFE_API_KEY: process.env.TYPESAFE_API_KEY,
};
const setupToken = "test-installer-code-with-at-least-32-characters";
const password = "my-long-setup-password";
const ai: AiSettingsInput = {
  chat: null, chatConsent: false, jev: null, jevConsent: false,
};

beforeEach(async () => {
  delete process.env.AUTH_PASSWORD_HASH;
  delete process.env.TYPESAFE_API_KEY;
  process.env.SETUP_TOKEN = setupToken;
  await resetData();
});
afterEach(() => {
  for (const [key, value] of Object.entries(environment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
afterAll(closeDb);

test("requires an explicitly configured installer token before offering setup", async () => {
  delete process.env.SETUP_TOKEN;
  expect(await setupState()).toBe("disabled");
  await expect(completeSetup({ setupToken, password, ai })).rejects.toMatchObject({ code: "unavailable" });
  expect(await query("SELECT id FROM users")).toHaveLength(0);
});

test("rejects an incorrect installer token without creating an owner", async () => {
  await expect(completeSetup({ setupToken: "incorrect-code-that-is-long-enough", password, ai }))
    .rejects.toMatchObject({ code: "forbidden" });
  expect(await query("SELECT id FROM users")).toHaveLength(0);
});

test("stores a usable password hash and closes setup after creating the owner", async () => {
  await completeSetup({ setupToken, password, ai });
  const hash = await loginPasswordHash();
  expect(hash).not.toBeNull();
  if (hash === null) throw new Error("Expected stored setup password");
  expect(await argon2.verify(hash, password)).toBe(true);
  expect(hash).not.toBe(password);
  expect(await setupState()).toBe("complete");
  await expect(completeSetup({ setupToken, password: "replacement-password", ai }))
    .rejects.toMatchObject({ code: "conflict" });
});

test("concurrent setup submissions commit exactly one owner and one configuration", async () => {
  const results = await Promise.allSettled([
    completeSetup({ setupToken, password, ai }),
    completeSetup({ setupToken, password: "another-long-password", ai }),
  ]);
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(await query("SELECT id FROM users")).toHaveLength(1);
  expect(await query("SELECT owner_id FROM installation_settings")).toHaveLength(1);
});

test("keeps legacy owners locked out of first-run setup without adopting their hash", async () => {
  await query("INSERT INTO users (password_hash) VALUES ($1)", ["legacy-hash"]);
  expect(await setupState()).toBe("complete");
  expect(await loginPasswordHash()).toBeNull();
  await expect(completeSetup({ setupToken, password, ai })).rejects.toMatchObject({ code: "conflict" });
  expect(await query("SELECT password_hash FROM users")).toEqual([{ password_hash: "legacy-hash" }]);
});

test("does not adopt an ownerless database that already contains protected notes", async () => {
  await query("INSERT INTO notes (title, body) VALUES ('existing-note', 'protected-body')");
  expect(await setupState()).toBe("complete");
  await expect(completeSetup({ setupToken, password, ai })).rejects.toMatchObject({ code: "conflict" });
  expect(await query("SELECT id FROM users")).toHaveLength(0);
});

test("keeps an environment-managed password authoritative over setup storage", async () => {
  await completeSetup({ setupToken, password, ai });
  const configured = "$argon2id$v=19$m=65536,t=3,p=4$c2FsdA$aGFzaA";
  process.env.AUTH_PASSWORD_HASH = configured;
  expect(await loginPasswordHash()).toBe(configured);
  expect(await setupState()).toBe("complete");
});

test("validates password confirmation and explicit optional data-sharing consent", () => {
  const base = { setupToken, password, passwordConfirmation: password, ai };
  expect(SetupInputSchema.safeParse(base).success).toBe(true);
  expect(SetupInputSchema.safeParse({ ...base, passwordConfirmation: "a-different-password" }).success).toBe(false);
  expect(SetupInputSchema.safeParse({ ...base, password: "short", passwordConfirmation: "short" }).success).toBe(false);
  expect(SetupInputSchema.safeParse({
    ...base,
    ai: { ...ai, chat: { mode: "api", provider: "openai", model: "test-model", apiKey: "test-api-key" } },
  }).success).toBe(false);
  expect(SetupInputSchema.safeParse({
    ...base, ai: { ...ai, jev: { provider: "typesafe", model: "jev-latest", apiKey: "test-typesafe-key" } },
  }).success).toBe(false);
  expect(SetupInputSchema.safeParse({
    ...base, ai: { ...ai, chatConsent: true, chat: { mode: "auth", provider: "anthropic", model: "claude-sonnet-4-6" } },
  }).success).toBe(false);
});

test("redacts saved keys and retains them only for the unchanged provider", async () => {
  const configured: AiSettingsInput = {
    chat: { mode: "api", provider: "openai", model: "test-model", apiKey: "secret-openai-key" },
    chatConsent: true,
    jev: { provider: "typesafe", model: "jev-latest", apiKey: "secret-typesafe-key" },
    jevConsent: true,
  };
  await completeSetup({ setupToken, password, ai: configured });
  const view = await aiSettingsView();
  expect(view.chat?.hasApiKey).toBe(true);
  expect(JSON.stringify(view)).not.toContain("secret-openai-key");
  expect(JSON.stringify(view)).not.toContain("secret-typesafe-key");
  await saveAiSettings({
    ...configured, chat: { mode: "api", provider: "openai", model: "another-model" },
    jev: { provider: "typesafe", model: "jev-latest" },
  });
  expect((await storedAiSettings())?.chat).toMatchObject({ apiKey: "secret-openai-key", model: "another-model" });
  await expect(saveAiSettings({
    ...configured, chat: { mode: "api", provider: "anthropic", model: "another-model" },
  })).rejects.toMatchObject({ code: "validation" });
  await expect(saveAiSettings({
    ...configured, jev: { provider: "openrouter", model: "~typesafe/jev-latest" },
  })).rejects.toMatchObject({ code: "validation" });
});

test("disabling optional AI removes saved credentials without changing the owner", async () => {
  await completeSetup({
    setupToken, password,
    ai: { ...ai, jev: { provider: "openrouter", model: "~typesafe/jev-latest", apiKey: "test-openrouter-key" }, jevConsent: true },
  });
  await saveAiSettings(ai);
  expect(await storedAiSettings()).toEqual({ chat: null, jev: null });
  expect(await setupState()).toBe("complete");
});

test("a saved Jev opt-out wins over ambient environment credentials", async () => {
  await completeSetup({ setupToken, password, ai });
  process.env.TYPESAFE_API_KEY = "ambient-key-not-user-consent";
  expect(await getJev()).toBeNull();
  expect((await aiSettingsView()).jev).toBeNull();
});
