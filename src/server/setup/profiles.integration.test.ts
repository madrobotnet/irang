import { afterAll, afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import type { AiSettingsInput, ConnectionProfileInput } from "@/lib/ai-settings";
import { query } from "@/server/db";
import { closeDb, connectTestDatabase, resetData } from "@/server/test/db";
import { deleteConnectionProfile, saveConnectionProfile } from "./ai-profiles";
import { completeSetup } from "./service";
import { aiSettingsView, saveAiSettings, storedAiSettings } from "./settings";

connectTestDatabase();
const off: AiSettingsInput = { chat: null, chatConsent: false, jev: null, jevConsent: false };
const token = "profile-test-installer-token-with-enough-characters";
const originalEnvironment = {
  SETUP_TOKEN: process.env.SETUP_TOKEN,
  AUTH_PASSWORD_HASH: process.env.AUTH_PASSWORD_HASH,
  TYPESAFE_API_KEY: process.env.TYPESAFE_API_KEY,
  TYPESAFE_BASE_URL: process.env.TYPESAFE_BASE_URL,
  CODEX_HOME: process.env.CODEX_HOME,
};
let authHome: string;

beforeEach(async () => {
  await resetData();
  delete process.env.AUTH_PASSWORD_HASH;
  delete process.env.TYPESAFE_API_KEY;
  delete process.env.TYPESAFE_BASE_URL;
  process.env.SETUP_TOKEN = token;
  authHome = await mkdtemp("/tmp/sb-profile-auth-");
  process.env.CODEX_HOME = authHome;
  await completeSetup({ setupToken: token, password: "profile-test-password", ai: off });
});
afterEach(async () => {
  await rm(authHome, { recursive: true, force: true });
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
afterAll(closeDb);

const custom: ConnectionProfileInput = {
  purpose: "chat", name: "local endpoint", consent: true,
  connection: {
    mode: "api", provider: "openai-compatible", baseUrl: "http://localhost:11434/v1",
    model: "fixture-model", apiKey: "fixture-secret-a", headers: { "x-workspace": "fixture-header-secret" },
  },
};

test("keeps named connections when switching or disabling active chat", async () => {
  const first = await saveConnectionProfile(custom);
  const second = await saveConnectionProfile({
    purpose: "chat", name: "other endpoint", consent: true,
    connection: { mode: "api", provider: "openai", model: "other-model", apiKey: "fixture-secret-b" },
  });
  expect((await aiSettingsView()).chat).toBeNull();
  await saveAiSettings({ ...off, chat: { mode: "saved", id: first.id }, chatConsent: true });
  expect((await storedAiSettings())?.chat).toMatchObject({ model: "fixture-model", apiKey: "fixture-secret-a" });
  await saveAiSettings({ ...off, chat: { mode: "saved", id: second.id }, chatConsent: true });
  expect((await storedAiSettings())?.chat).toMatchObject({ model: "other-model", apiKey: "fixture-secret-b" });
  await saveAiSettings(off);
  const view = await aiSettingsView();
  expect(view.chat).toBeNull();
  expect(view.profiles).toHaveLength(2);
  expect(JSON.stringify(view)).not.toContain("fixture-secret");
  expect(JSON.stringify(view)).not.toContain("fixture-header-secret");
});

test("binds retained keys and extra headers to an unchanged destination", async () => {
  const profile = await saveConnectionProfile(custom);
  await saveConnectionProfile({
    ...custom,
    connection: { mode: "api", provider: "openai-compatible", baseUrl: "http://localhost:11434/v1", model: "changed-model" },
  }, { id: profile.id });
  await saveAiSettings({ ...off, chat: { mode: "saved", id: profile.id }, chatConsent: true });
  expect((await storedAiSettings())?.chat).toMatchObject({
    apiKey: "fixture-secret-a", headers: { "x-workspace": "fixture-header-secret" }, model: "changed-model",
  });
  await expect(saveConnectionProfile({
    ...custom, connection: { mode: "api", provider: "openai-compatible", baseUrl: "https://different.example/v1", model: "changed-model" },
  }, { id: profile.id })).rejects.toMatchObject({ code: "validation" });
  await saveConnectionProfile({
    ...custom,
    connection: {
      mode: "api", provider: "openai-compatible", baseUrl: "https://different.example/v1",
      model: "changed-model", apiKey: "new-key",
    },
  }, { id: profile.id });
  expect((await storedAiSettings())?.chat).toMatchObject({ apiKey: "new-key" });
  expect((await aiSettingsView()).chat?.headerNames).toEqual([]);
});

test("requires an explicit keyless choice for new and moved custom connections", async () => {
  const connection = {
    mode: "api", provider: "openai-compatible",
    baseUrl: "http://localhost:11434/v1", model: "keyless-fixture",
  } as const;
  await expect(saveConnectionProfile({ ...custom, connection }))
    .rejects.toMatchObject({ code: "validation" });
  const profile = await saveConnectionProfile({
    ...custom, connection: { ...connection, apiKey: "" },
  });
  await expect(saveConnectionProfile({ ...custom, connection }, { id: profile.id }))
    .resolves.toMatchObject({ connection: { apiKey: "" } });
  const moved = { ...connection, baseUrl: "http://localhost:22434/v1" };
  await expect(saveConnectionProfile({ ...custom, connection: moved }, { id: profile.id }))
    .rejects.toMatchObject({ code: "validation" });
  await expect(saveConnectionProfile({
    ...custom, connection: { ...moved, apiKey: "" },
  }, { id: profile.id })).resolves.toMatchObject({
    connection: { baseUrl: moved.baseUrl, apiKey: "" },
  });
});

test("adds, changes and disables Jev independently of chat profiles", async () => {
  const first = await saveConnectionProfile({
    purpose: "jev", name: "official Jev", consent: true,
    connection: { provider: "typesafe", model: "jev-latest", apiKey: "jev-first-key" },
  });
  const second = await saveConnectionProfile({
    purpose: "jev", name: "router Jev", consent: true,
    connection: { provider: "openrouter", model: "~typesafe/jev-latest", apiKey: "jev-second-key" },
  });
  await saveAiSettings({ ...off, jev: { mode: "saved", id: first.id }, jevConsent: true });
  expect((await storedAiSettings())?.jev).toMatchObject({ provider: "typesafe", apiKey: "jev-first-key" });
  await saveAiSettings({ ...off, jev: { mode: "saved", id: second.id }, jevConsent: true });
  expect((await storedAiSettings())?.jev).toMatchObject({ provider: "openrouter", apiKey: "jev-second-key" });
  await saveAiSettings(off);
  expect((await storedAiSettings())?.jev).toBeNull();
  expect((await aiSettingsView()).profiles).toHaveLength(2);
});

test("rejects cross-purpose selection and disables a deleted active profile", async () => {
  const profile = await saveConnectionProfile(custom);
  await expect(saveAiSettings({ ...off, jev: { mode: "saved", id: profile.id }, jevConsent: true }))
    .rejects.toMatchObject({ code: "validation" });
  await saveAiSettings({ ...off, chat: { mode: "saved", id: profile.id }, chatConsent: true });
  await deleteConnectionProfile(profile.id);
  expect((await aiSettingsView()).chatId).toBeNull();
  expect((await aiSettingsView()).profiles).toHaveLength(0);
});

test("adding an inactive connection preserves environment-managed installation state", async () => {
  await query("DELETE FROM installation_settings");
  process.env.TYPESAFE_API_KEY = "legacy-environment-key";
  await saveConnectionProfile(custom);
  expect(await storedAiSettings()).toBeNull();
  expect((await aiSettingsView()).jevManagedByEnvironment).toBe(true);
});
