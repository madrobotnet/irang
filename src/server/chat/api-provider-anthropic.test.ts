import { describe, expect, test } from "bun:test";
import { createApiProvider } from "./api-provider";
import { fragmentedResponse, TEST_INPUT } from "./api-provider-test-helpers";

describe("Anthropic API provider", () => {
  test("streams fragmented Messages events and preserves request semantics", async () => {
    const requests: Array<{ readonly url: string; readonly headers: Headers; readonly body: string }> = [];
    const fetchImpl: typeof fetch = Object.assign(
      async (url: RequestInfo | URL, init?: RequestInit) => {
        requests.push({
          url: String(url),
          headers: new Headers(init?.headers),
          body: String(init?.body),
        });
        return fragmentedResponse([
          'event: content_block_delta\r\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"금요',
          '일"}}\r\n\r\nevent: ping\ndata: {"type":"ping"}\n\n',
          'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":" 오전"}}\n\n',
          'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n',
          'event: message_stop\ndata: {"type":"message_stop"}\n\n',
        ]);
      },
      { preconnect: fetch.preconnect },
    );
    const provider = createApiProvider(
      { provider: "anthropic", apiKey: "anthropic-secret", model: "claude-test" },
      { fetchImpl },
    );
    const deltas: string[] = [];

    const answer = await provider.stream(TEST_INPUT, (delta) => deltas.push(delta), new AbortController().signal);

    expect(answer).toBe("금요일 오전");
    expect(deltas).toEqual(["금요일", " 오전"]);
    expect(requests[0]?.url).toBe("https://api.anthropic.com/v1/messages");
    expect(requests[0]?.headers.get("x-api-key")).toBe("anthropic-secret");
    expect(requests[0]?.headers.get("anthropic-version")).toBe("2023-06-01");
    expect(JSON.parse(requests[0]?.body ?? "{}")).toMatchObject({
      model: "claude-test",
      messages: [
        { role: "user", content: TEST_INPUT.history[0].content },
        { role: "assistant", content: TEST_INPUT.history[1].content },
        { role: "user" },
      ],
      tools: [],
      stream: true,
    });
    expect(requests[0]?.body).toContain(TEST_INPUT.question);
    expect(requests[0]?.body).toContain(TEST_INPUT.sources[0].noteId);
  });

  test("rejects an in-stream error event", async () => {
    const fetchImpl: typeof fetch = Object.assign(
      async () =>
        fragmentedResponse(['event: error\ndata: {"type":"error","error":{"type":"overloaded_error"}}\n\n']),
      { preconnect: fetch.preconnect },
    );
    const provider = createApiProvider(
      { provider: "anthropic", apiKey: "key", model: "model" },
      { fetchImpl },
    );

    await expect(provider.stream(TEST_INPUT, () => undefined, new AbortController().signal))
      .rejects.toMatchObject({ name: "ChatProviderError" });
  });

  test("rejects a stream missing message_stop", async () => {
    const fetchImpl: typeof fetch = Object.assign(
      async () => fragmentedResponse([
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"부분"}}\n\n',
        'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n',
      ]),
      { preconnect: fetch.preconnect },
    );
    const provider = createApiProvider(
      { provider: "anthropic", apiKey: "key", model: "model" },
      { fetchImpl },
    );

    await expect(provider.stream(TEST_INPUT, () => undefined, new AbortController().signal))
      .rejects.toMatchObject({ name: "ChatProviderError" });
  });
});
