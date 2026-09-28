import { describe, expect, test } from "bun:test";
import { createApiProvider } from "./api-provider";
import { fragmentedResponse, TEST_INPUT } from "./api-provider-test-helpers";

describe("Google API provider", () => {
  test("streams fragmented generateContent responses and preserves request semantics", async () => {
    const requests: Array<{ readonly url: string; readonly headers: Headers; readonly body: string }> = [];
    const fetchImpl: typeof fetch = Object.assign(
      async (url: RequestInfo | URL, init?: RequestInit) => {
        requests.push({
          url: String(url),
          headers: new Headers(init?.headers),
          body: String(init?.body),
        });
        return fragmentedResponse([
          'data: {"candidates":[{"index":0,"content":{"parts":[{"text":"금요',
          '일"}]}}]}\r\n\r\ndata: {"candidates":[{"index":0,"content":{"parts":[{"thought":true,"text":"숨김"}',
          ',{"text":" 오전"}]},"finishReason":"STOP"}]}\n\n',
        ]);
      },
      { preconnect: fetch.preconnect },
    );
    const provider = createApiProvider(
      { provider: "google", apiKey: "google-secret", model: "models/gemini-test" },
      { fetchImpl },
    );
    const deltas: string[] = [];

    const answer = await provider.stream(TEST_INPUT, (delta) => deltas.push(delta), new AbortController().signal);

    expect(answer).toBe("금요일 오전");
    expect(deltas).toEqual(["금요일", " 오전"]);
    expect(requests[0]?.url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-test:streamGenerateContent?alt=sse",
    );
    expect(requests[0]?.headers.get("x-goog-api-key")).toBe("google-secret");
    expect(JSON.parse(requests[0]?.body ?? "{}")).toMatchObject({
      contents: [
        { role: "user", parts: [{ text: TEST_INPUT.history[0].content }] },
        { role: "model", parts: [{ text: TEST_INPUT.history[1].content }] },
        { role: "user" },
      ],
      tools: [],
      store: false,
    });
    expect(requests[0]?.body).toContain(TEST_INPUT.question);
    expect(requests[0]?.body).toContain(TEST_INPUT.sources[0].noteId);
  });

  test("rejects a non-success finish reason", async () => {
    const fetchImpl: typeof fetch = Object.assign(
      async () => fragmentedResponse([
        'data: {"candidates":[{"index":0,"content":{"parts":[{"text":"부분"}]},"finishReason":"SAFETY"}]}\n\n',
      ]),
      { preconnect: fetch.preconnect },
    );
    const provider = createApiProvider(
      { provider: "google", apiKey: "key", model: "model" },
      { fetchImpl },
    );

    await expect(provider.stream(TEST_INPUT, () => undefined, new AbortController().signal))
      .rejects.toMatchObject({ name: "ChatProviderError" });
  });

  test("rejects a stream missing STOP", async () => {
    const fetchImpl: typeof fetch = Object.assign(
      async () => fragmentedResponse([
        'data: {"candidates":[{"index":0,"content":{"parts":[{"text":"부분"}]}}]}\n\n',
      ]),
      { preconnect: fetch.preconnect },
    );
    const provider = createApiProvider(
      { provider: "google", apiKey: "key", model: "model" },
      { fetchImpl },
    );

    await expect(provider.stream(TEST_INPUT, () => undefined, new AbortController().signal))
      .rejects.toMatchObject({ name: "ChatProviderError" });
  });
});
