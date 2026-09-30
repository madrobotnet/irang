import { afterAll, afterEach, beforeEach, expect, test } from "bun:test";
import type { OAuthCredential } from "@/lib/ai-auth";
import { query } from "@/server/db";
import { saveConnectionProfile } from "@/server/setup/ai-profiles";
import { saveAiSettings } from "@/server/setup/settings";
import { closeDb, connectTestDatabase, resetData } from "@/server/test/db";
import { createChatMessageStream, createChatThread, getChatThread } from "./service";

connectTestDatabase();
const originalFetch = globalThis.fetch;
beforeEach(resetData);
afterEach(() => { globalThis.fetch = originalFetch; });
afterAll(closeDb);

const cases: ReadonlyArray<{ credential: OAuthCredential; url: string; stream: string }> = [
  {
    credential: { provider: "openai", accessToken: "codex-profile-access", refreshToken: "codex-profile-refresh",
      accountId: "profile-account", expiresAt: Date.now() + 3_600_000 },
    url: "https://chatgpt.com/backend-api/codex/responses",
    stream: 'data: {"type":"response.output_text.delta","delta":"auth-response"}\n\n'
      + 'data: {"type":"response.completed","response":{}}\n\n',
  },
  {
    credential: {
      provider: "github-copilot", accessToken: "copilot-access", refreshToken: "github-refresh",
      baseUrl: "https://api.business.githubcopilot.com", expiresAt: Date.now() + 3_600_000,
    },
    url: "https://api.business.githubcopilot.com/responses",
    stream: 'data: {"type":"response.output_text.delta","delta":"auth-response"}\n\n'
      + 'data: {"type":"response.completed","response":{}}\n\n',
  },
  {
    credential: { provider: "openrouter", accessToken: "router-access" },
    url: "https://openrouter.ai/api/v1/chat/completions",
    stream: 'data: {"choices":[{"index":0,"delta":{"content":"auth-response"},"finish_reason":"stop"}]}\n\n'
      + 'data: [DONE]\n\n',
  },
  {
    credential: { provider: "xai", accessToken: "xai-access", refreshToken: "xai-refresh", expiresAt: Date.now() + 3_600_000 },
    url: "https://api.x.ai/v1/responses",
    stream: 'data: {"type":"response.output_text.delta","delta":"auth-response"}\n\n'
      + 'data: {"type":"response.completed","response":{}}\n\n',
  },
];

for (const candidate of cases) {
  test(`saved ${candidate.credential.provider} Auth profile reaches retrieval, HTTP transport and persistence`, async () => {
    const owners = await query<{ id: string }>("INSERT INTO users (password_hash) VALUES ('fixture-hash') RETURNING id");
    const owner = owners[0];
    if (!owner) throw new Error("Owner fixture was not created");
    const browserHash = "c".repeat(64);
    const attemptId = crypto.randomUUID();
    await query(
      `INSERT INTO ai_auth_attempts (id, provider, scope_key, browser_hash, status, payload, expires_at)
       VALUES ($1, $2, $3, $4, 'ready', $5::jsonb, now() + interval '15 minutes')`,
      [attemptId, candidate.credential.provider, `owner:${owner.id}`, browserHash, JSON.stringify(candidate.credential)],
    );
    const profile = await saveConnectionProfile({
      purpose: "chat", name: "Auth fixture", consent: true,
      connection: { mode: "auth", provider: candidate.credential.provider, model: "auth-fixture-model", authAttemptId: attemptId },
    }, { browserHash });
    await saveAiSettings({ chat: { mode: "saved", id: profile.id }, chatConsent: true, jev: null, jevConsent: false });
    await query("INSERT INTO notes (title, body) VALUES ($1, $1)", ["auth-provider-dispatch"]);
    const requests: Array<{ body: unknown; authorization: string | null }> = [];
    const upstream = Bun.serve({
      port: 0,
      async fetch(request) {
        requests.push({ body: await request.json(), authorization: request.headers.get("authorization") });
        return new Response(candidate.stream, { headers: { "content-type": "text/event-stream" } });
      },
    });
    globalThis.fetch = Object.assign(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe(candidate.url);
      return originalFetch(upstream.url, init);
    }, { preconnect: originalFetch.preconnect });
    try {
      const thread = await createChatThread();
      await (await createChatMessageStream(thread.id, "auth-provider-dispatch")).text();
      expect(requests).toHaveLength(1);
      expect(requests[0]?.authorization).toBe(`Bearer ${candidate.credential.accessToken}`);
      expect(requests[0]?.body).toMatchObject({ model: "auth-fixture-model" });
      expect((await getChatThread(thread.id)).messages.map((message) => message.content))
        .toEqual(["auth-provider-dispatch", "auth-response"]);
    } finally {
      await upstream.stop(true);
    }
  });
}
