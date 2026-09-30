import { afterEach, describe, expect, test } from "bun:test";
import {
  createApiProvider,
  type ApiFormat,
} from "./api-provider";
import { fragmentedResponse, TEST_INPUT } from "./api-provider-test-helpers";

const servers: Array<ReturnType<typeof Bun.serve>> = [];
const INVALID_TRANSPORTS: readonly {
  readonly baseUrl: string;
  readonly headers?: Readonly<Record<string, string>>;
}[] = [
  { baseUrl: "ftp://host.test" },
  { baseUrl: "https://user:pass@host.test" },
  { baseUrl: "https://host.test?token=value" },
  { baseUrl: "https://host.test#fragment" },
  { baseUrl: "https://host.test", headers: { Host: "elsewhere.test" } },
  { baseUrl: "https://host.test", headers: { "X-Test": "safe\r\nInjected: yes" } },
];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.stop(true)));
});

function successfulStream(format: ApiFormat, text = "wire-ok"): Response {
  switch (format) {
    case "chat-completions":
      return fragmentedResponse([
        `data: {"choices":[{"index":0,"delta":{"content":"${text}"},"finish_reason":null}]}\n\n`,
        'data: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
      ]);
    case "responses":
      return fragmentedResponse([
        `data: {"type":"response.output_text.delta","delta":"${text}"}\n\n`,
        'data: {"type":"response.completed","response":{}}\n\n',
      ]);
    case "anthropic-messages":
      return fragmentedResponse([
        `data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"${text}"}}\n\n`,
        'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n',
        'data: {"type":"message_stop"}\n\n',
      ]);
  }
}

describe("custom API transports", () => {
  for (const format of ["chat-completions", "responses", "anthropic-messages"] as const) {
    test(`streams CR-delimited ${format} events over the actual HTTP transport`, async () => {
      const server = Bun.serve({
        hostname: "127.0.0.1",
        port: 0,
        async fetch() {
          const body = (await successfulStream(format).text()).replaceAll("\n", "\r");
          return new Response(body, { headers: { "content-type": "text/event-stream" } });
        },
      });
      servers.push(server);
      const provider = createApiProvider({
        provider: format === "anthropic-messages" ? "anthropic-compatible" : "openai-compatible",
        apiKey: "",
        model: "cr-fixture",
        baseUrl: server.url.toString(),
        apiFormat: format,
      });
      const deltas: string[] = [];

      const output = await provider.stream(TEST_INPUT, (delta) => deltas.push(delta), new AbortController().signal);

      expect(output).toBe("wire-ok");
      expect(deltas).toEqual(["wire-ok"]);
    });
  }

  test("sends Chat Completions to a root URL with merged headers and output limit", async () => {
    const requests: Request[] = [];
    const bodies: unknown[] = [];
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request) {
        requests.push(request);
        bodies.push(await request.json());
        return successfulStream("chat-completions");
      },
    });
    servers.push(server);
    const provider = createApiProvider({
      provider: "openai-compatible",
      apiKey: "default-key",
      model: "custom-chat-model",
      baseUrl: server.url.toString(),
      headers: { AUTHORIZATION: "Token override", "X-Trace": "wire-fixture" },
      maxOutputTokens: 321,
    });

    const output = await provider.stream(TEST_INPUT, () => undefined, new AbortController().signal);

    expect(output).toBe("wire-ok");
    expect(requests[0]?.url).toBe(`${server.url}v1/chat/completions`);
    expect(requests[0]?.headers.get("authorization")).toBe("Token override");
    expect(requests[0]?.headers.get("x-trace")).toBe("wire-fixture");
    expect(bodies[0]).toMatchObject({
      model: "custom-chat-model",
      max_tokens: 321,
      stream: true,
      tools: [],
    });
  });

  test("sends keyless Messages to a supplied prefix without duplicating its endpoint", async () => {
    const requests: Request[] = [];
    const bodies: unknown[] = [];
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request) {
        requests.push(request);
        bodies.push(await request.json());
        return successfulStream("anthropic-messages");
      },
    });
    servers.push(server);
    const endpoint = new URL("/gateway/api/messages", server.url).toString();
    const provider = createApiProvider({
      provider: "anthropic-compatible",
      apiKey: "",
      model: "custom-messages-model",
      baseUrl: endpoint,
      maxOutputTokens: 654,
    });

    const output = await provider.stream(TEST_INPUT, () => undefined, new AbortController().signal);

    expect(output).toBe("wire-ok");
    expect(requests[0]?.url).toBe(endpoint);
    expect(requests[0]?.headers.get("x-api-key")).toBeNull();
    expect(requests[0]?.headers.get("anthropic-version")).toBe("2023-06-01");
    expect(bodies[0]).toMatchObject({
      model: "custom-messages-model",
      max_tokens: 654,
      stream: true,
      tools: [],
    });
  });

  for (const invalid of INVALID_TRANSPORTS) {
    test(`rejects unsafe custom transport input ${JSON.stringify(invalid)}`, () => {
      expect(() => createApiProvider({
        provider: "openai-compatible",
        apiKey: "",
        model: "model",
        baseUrl: invalid.baseUrl,
        headers: invalid.headers,
      })).toThrow();
    });
  }

  test("does not follow a credential-bearing redirect", async () => {
    let redirectedRequests = 0;
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch(request) {
        const path = new URL(request.url).pathname;
        if (path === "/capture") {
          redirectedRequests += 1;
          return successfulStream("chat-completions");
        }
        return Response.redirect(new URL("/capture", request.url), 307);
      },
    });
    servers.push(server);
    const provider = createApiProvider({
      provider: "openai-compatible",
      apiKey: "must-not-follow",
      model: "model",
      baseUrl: new URL("/v1/chat/completions", server.url).toString(),
    });

    await expect(provider.stream(TEST_INPUT, () => undefined, new AbortController().signal))
      .rejects.toMatchObject({ name: "ChatProviderError" });
    expect(redirectedRequests).toBe(0);
  });
});

describe("Chat Completions terminal framing", () => {
  for (const fixture of [
    {
      name: "accepts stop followed by DONE",
      chunks: [
        'data: {"choices":[{"index":0,"delta":{"content":"complete"},"finish_reason":"stop"}]}\n\n',
        "data: [DONE]\n\n",
      ],
      succeeds: true,
    },
    {
      name: "rejects DONE without stop",
      chunks: [
        'data: {"choices":[{"index":0,"delta":{"content":"truncated"},"finish_reason":null}]}\n\n',
        "data: [DONE]\n\n",
      ],
      succeeds: false,
    },
    {
      name: "rejects stop without DONE",
      chunks: [
        'data: {"choices":[{"index":0,"delta":{"content":"truncated"},"finish_reason":"stop"}]}\n\n',
      ],
      succeeds: false,
    },
    {
      name: "rejects a non-stop finish reason",
      chunks: [
        'data: {"choices":[{"index":0,"delta":{"content":"limited"},"finish_reason":"length"}]}\n\n',
        "data: [DONE]\n\n",
      ],
      succeeds: false,
    },
  ] as const) {
    test(fixture.name, async () => {
      const fetchImpl: typeof fetch = Object.assign(
        async () => fragmentedResponse(fixture.chunks),
        { preconnect: fetch.preconnect },
      );
      const provider = createApiProvider(
        { provider: "openrouter", apiKey: "key", model: "model" },
        { fetchImpl },
      );
      const pending = provider.stream(TEST_INPUT, () => undefined, new AbortController().signal);

      if (fixture.succeeds) await expect(pending).resolves.toBe("complete");
      else await expect(pending).rejects.toMatchObject({ name: "ChatProviderError" });
    });
  }
});
