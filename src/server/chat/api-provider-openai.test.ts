import { describe, expect, test } from "bun:test";
import { createApiProvider } from "./api-provider";
import { fragmentedResponse, TEST_INPUT } from "./api-provider-test-helpers";

describe("OpenAI API provider", () => {
  test("streams fragmented Responses events and preserves request semantics", async () => {
    const requests: Array<{ readonly url: string; readonly headers: Headers; readonly body: string }> = [];
    const fetchImpl: typeof fetch = Object.assign(
      async (url: RequestInfo | URL, init?: RequestInit) => {
        requests.push({
          url: String(url),
          headers: new Headers(init?.headers),
          body: String(init?.body),
        });
        return fragmentedResponse([
          'data: {"type":"response.output_text.delta","delta":"금요',
          '일"}\r\n\r\ndata: {"type":"response.output_text.delta","delta":" 오전"}\n',
          '\ndata: {"type":"response.completed","response":{}}\n\n',
        ]);
      },
      { preconnect: fetch.preconnect },
    );
    const provider = createApiProvider(
      { provider: "openai", apiKey: "openai-secret", model: "gpt-test" },
      { fetchImpl },
    );
    const deltas: string[] = [];

    const answer = await provider.stream(TEST_INPUT, (delta) => deltas.push(delta), new AbortController().signal);

    expect(answer).toBe("금요일 오전");
    expect(deltas).toEqual(["금요일", " 오전"]);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe("https://api.openai.com/v1/responses");
    expect(requests[0]?.headers.get("authorization")).toBe("Bearer openai-secret");
    expect(JSON.parse(requests[0]?.body ?? "{}")).toMatchObject({
      model: "gpt-test",
      input: [
        { role: "user", content: TEST_INPUT.history[0].content },
        { role: "assistant", content: TEST_INPUT.history[1].content },
        { role: "user" },
      ],
      tools: [],
      store: false,
      stream: true,
    });
    expect(requests[0]?.body).toContain(TEST_INPUT.question);
    expect(requests[0]?.body).toContain(TEST_INPUT.sources[0].noteId);
  });

  test("rejects a failed terminal event", async () => {
    const fetchImpl: typeof fetch = Object.assign(
      async () => fragmentedResponse(['data: {"type":"response.failed","response":{}}\n\n']),
      { preconnect: fetch.preconnect },
    );
    const provider = createApiProvider(
      { provider: "openai", apiKey: "key", model: "model" },
      { fetchImpl },
    );

    await expect(provider.stream(TEST_INPUT, () => undefined, new AbortController().signal))
      .rejects.toMatchObject({ name: "ChatProviderError" });
  });

  test("rejects a stream truncated after deltas", async () => {
    const fetchImpl: typeof fetch = Object.assign(
      async () => fragmentedResponse(['data: {"type":"response.output_text.delta","delta":"부분"}\n\n']),
      { preconnect: fetch.preconnect },
    );
    const provider = createApiProvider(
      { provider: "openai", apiKey: "key", model: "model" },
      { fetchImpl },
    );

    await expect(provider.stream(TEST_INPUT, () => undefined, new AbortController().signal))
      .rejects.toMatchObject({ name: "ChatProviderError" });
  });
});
