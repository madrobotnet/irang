import { afterAll, afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AiSettingsInput } from "@/lib/ai-settings";
import { query } from "@/server/db";
import { completeSetup } from "@/server/setup/service";
import { closeDb, connectTestDatabase, resetData } from "@/server/test/db";
import { configuredChatProvider } from "./connection";
import { createChatMessageStream, createChatThread, getChatThread } from "./service";

connectTestDatabase();
const originalFetch = globalThis.fetch;
const environment = {
  AUTH_PASSWORD_HASH: process.env.AUTH_PASSWORD_HASH,
  SETUP_TOKEN: process.env.SETUP_TOKEN,
  CODEX_HOME: process.env.CODEX_HOME,
};
const directories: string[] = [];
const setupToken = "test-configured-provider-installer-token";
const aiOff: AiSettingsInput = {
  chat: null, chatConsent: false, jev: null, jevConsent: false,
};

beforeEach(async () => {
  delete process.env.AUTH_PASSWORD_HASH;
  process.env.SETUP_TOKEN = setupToken;
  await resetData();
});
afterEach(async () => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(environment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});
afterAll(async () => {
  await resetData();
  await closeDb();
});

const cases = [
  {
    provider: "openai",
    url: "https://api.openai.com/v1/responses",
    header: "authorization",
    credential: "Bearer secret",
    stream: 'data: {"type":"response.output_text.delta","delta":"configured-response"}\n\n'
      + 'data: {"type":"response.completed","response":{}}\n\n',
  },
  {
    provider: "anthropic",
    url: "https://api.anthropic.com/v1/messages",
    header: "x-api-key",
    credential: "secret",
    stream: 'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"configured-response"}}\n\n'
      + 'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n'
      + 'data: {"type":"message_stop"}\n\n',
  },
  {
    provider: "google",
    url: "https://generativelanguage.googleapis.com/v1beta/models/saved-model:streamGenerateContent?alt=sse",
    header: "x-goog-api-key",
    credential: "secret",
    stream: 'data: {"candidates":[{"index":0,"content":{"parts":[{"text":"configured-response"}]},"finishReason":"STOP"}]}\n\n',
  },
] as const;

for (const candidate of cases) {
  test(`saved ${candidate.provider} settings reach the real chat service and wire adapter`, async () => {
    await completeSetup({
      setupToken,
      password: "test-configured-provider-password",
      ai: {
        ...aiOff,
        chat: { provider: candidate.provider, mode: "api", model: "saved-model", apiKey: "secret" },
        chatConsent: true,
      },
    });
    await query("INSERT INTO notes (title, body) VALUES ($1, $1)", ["configured-provider-dispatch"]);
    const requests: Array<{ body: unknown; credential: string | null }> = [];
    const upstream = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request) {
        const body: unknown = await request.json();
        requests.push({ body, credential: request.headers.get(candidate.header) });
        return new Response(candidate.stream, { headers: { "content-type": "text/event-stream" } });
      },
    });
    // Redirect only the external boundary; configuration, dispatch, transport,
    // HTTP streaming, retrieval and persistence all use production code.
    globalThis.fetch = Object.assign(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe(candidate.url);
        return originalFetch(upstream.url, init);
      },
      { preconnect: originalFetch.preconnect },
    );
    try {
      const thread = await createChatThread();
      const response = await createChatMessageStream(thread.id, "configured-provider-dispatch");
      await response.text();
      expect(requests).toHaveLength(1);
      expect(requests[0]?.credential).toBe(candidate.credential);
      if (candidate.provider !== "google") {
        expect(requests[0]?.body).toMatchObject({ model: "saved-model" });
      }
      expect((await getChatThread(thread.id)).messages.map((message) => message.content))
        .toEqual(["configured-provider-dispatch", "configured-response"]);
    } finally {
      await upstream.stop(true);
    }
  });
}

test("an explicit chat opt-out overrides an otherwise usable legacy Auth file", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "second-brain-dispatch-auth-"));
  directories.push(directory);
  process.env.CODEX_HOME = directory;
  await writeFile(path.join(directory, "auth.json"), JSON.stringify({
    auth_mode: "chatgpt",
    tokens: { access_token: "not-an-auth-token", account_id: "test-account" },
  }), { mode: 0o600 });
  expect(await configuredChatProvider()).not.toBeNull();

  await completeSetup({
    setupToken, password: "test-configured-provider-password", ai: aiOff,
  });
  expect(await configuredChatProvider()).toBeNull();
});
