import { expect, test } from "bun:test";
import { ChatConnectionSchema } from "@/lib/ai-settings";
import { createApiProvider } from "./api-provider";
import { TEST_INPUT } from "./api-provider-test-helpers";

const STREAMS = {
  responses: 'data: {"type":"response.output_text.delta","delta":"copilot-wire"}\n\n'
    + 'data: {"type":"response.completed","response":{}}\n\n',
  "chat-completions": 'data: {"choices":[{"delta":{"content":"copilot-wire"},"finish_reason":"stop"}]}\n\n'
    + "data: [DONE]\n\n",
  "anthropic-messages": 'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"copilot-wire"}}\n\n'
    + 'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n'
    + 'data: {"type":"message_stop"}\n\n',
} as const;

for (const [account, format, endpoint] of [
  ["business", "responses", "/responses"],
  ["enterprise", "chat-completions", "/chat/completions"],
  ["enterprise", "anthropic-messages", "/v1/messages"],
] as const) {
  test(`sends a validated Copilot ${account} profile over ${format} HTTP`, async () => {
    const token = `tid=fixture;proxy-ep=proxy.${account}.githubcopilot.com;sig=fixture`;
    const input = ChatConnectionSchema.parse({
      mode: "api", provider: "github-copilot", apiKey: token,
      model: "copilot-fixture", apiFormat: format,
    });
    if (input.mode !== "api") throw new Error("Fixture must be an API connection");
    const received: Array<{ path: string; origin: string | null; authorization: string | null; body: unknown }> = [];
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request) {
        received.push({
          path: new URL(request.url).pathname,
          origin: request.headers.get("x-fixture-target-origin"),
          authorization: request.headers.get("authorization"),
          body: await request.json(),
        });
        return new Response(STREAMS[format], { headers: { "content-type": "text/event-stream" } });
      },
    });
    try {
      const fetchImpl: typeof fetch = Object.assign(
        async (url: RequestInfo | URL, init?: RequestInit) => {
          const target = new URL(String(url));
          const headers = new Headers(init?.headers);
          // Map DNS/TLS to a local fixture, preserving the adapter's chosen origin.
          headers.set("x-fixture-target-origin", target.origin);
          return fetch(new URL(target.pathname, server.url), { ...init, headers });
        },
        { preconnect: fetch.preconnect },
      );
      const provider = createApiProvider(input, { fetchImpl });
      const deltas: string[] = [];

      const result = await provider.stream(TEST_INPUT, delta => deltas.push(delta), new AbortController().signal);

      expect(result).toBe("copilot-wire");
      expect(deltas).toEqual(["copilot-wire"]);
      expect(received).toHaveLength(1);
      expect(received[0]).toMatchObject({
        path: endpoint,
        origin: `https://api.${account}.githubcopilot.com`,
        authorization: `Bearer ${token}`,
        body: { model: "copilot-fixture", stream: true },
      });
    } finally {
      await server.stop(true);
    }
  });
}
