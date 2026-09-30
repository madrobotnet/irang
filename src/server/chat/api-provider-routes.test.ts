import { describe, expect, test } from "bun:test";
import {
  createApiProvider,
  type ApiFormat,
  type ApiProviderInput,
} from "./api-provider";
import { fragmentedResponse, TEST_INPUT } from "./api-provider-test-helpers";

function successfulStream(format: ApiFormat): Response {
  switch (format) {
    case "chat-completions":
      return fragmentedResponse([
        'data: {"choices":[{"index":0,"delta":{"content":"wire-ok"},"finish_reason":null}]}\n\n',
        'data: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
      ]);
    case "responses":
      return fragmentedResponse([
        'data: {"type":"response.output_text.delta","delta":"wire-ok"}\n\n',
        'data: {"type":"response.completed","response":{}}\n\n',
      ]);
    case "anthropic-messages":
      return fragmentedResponse([
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"wire-ok"}}\n\n',
        'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n',
        'data: {"type":"message_stop"}\n\n',
      ]);
  }
}

const ROUTES = [
  {
    name: "Copilot GHE token Responses",
    input: {
      provider: "github-copilot",
      apiKey: "tid=1;proxy-ep=copilot-api.fixture.ghe.com;sig=fixture",
      model: "copilot-enterprise",
      maxOutputTokens: 204,
    },
    format: "responses",
    url: "https://copilot-api.fixture.ghe.com/responses",
    outputLimit: ["max_output_tokens", 204],
  },
  {
    name: "Copilot Business token Responses default",
    input: {
      provider: "github-copilot",
      apiKey: "tid=1;proxy-ep=proxy.business.githubcopilot.com;sig=fixture",
      model: "copilot-business",
      maxOutputTokens: 201,
    },
    format: "responses",
    url: "https://api.business.githubcopilot.com/responses",
    outputLimit: ["max_output_tokens", 201],
  },
  {
    name: "Copilot Enterprise token Chat Completions",
    input: {
      provider: "github-copilot",
      apiKey: "tid=1;proxy-ep=proxy.enterprise.githubcopilot.com;sig=fixture",
      model: "copilot-enterprise",
      apiFormat: "chat-completions",
      maxOutputTokens: 202,
    },
    format: "chat-completions",
    url: "https://api.enterprise.githubcopilot.com/chat/completions",
    outputLimit: ["max_tokens", 202],
  },
  {
    name: "Copilot Enterprise token Anthropic Messages",
    input: {
      provider: "github-copilot",
      apiKey: "tid=1;proxy-ep=proxy.enterprise.githubcopilot.com;sig=fixture",
      model: "claude-sonnet-4.6",
      apiFormat: "anthropic-messages",
      maxOutputTokens: 203,
    },
    format: "anthropic-messages",
    url: "https://api.enterprise.githubcopilot.com/v1/messages",
    outputLimit: ["max_tokens", 203],
  },
  {
    name: "Copilot Responses default",
    input: {
      provider: "github-copilot",
      apiKey: "tid=1;proxy-ep=proxy.business.githubcopilot.com;sig=fixture",
      model: "copilot-model",
      baseUrl: "https://copilot.example/account",
      maxOutputTokens: 101,
    },
    format: "responses",
    url: "https://copilot.example/account/responses",
    outputLimit: ["max_output_tokens", 101],
  },
  {
    name: "Copilot Chat Completions",
    input: {
      provider: "github-copilot",
      apiKey: "copilot-key",
      model: "copilot-model",
      baseUrl: "https://copilot.example",
      apiFormat: "chat-completions",
      maxOutputTokens: 102,
    },
    format: "chat-completions",
    url: "https://copilot.example/chat/completions",
    outputLimit: ["max_tokens", 102],
  },
  {
    name: "Copilot Anthropic Messages default endpoint",
    input: {
      provider: "github-copilot",
      apiKey: "copilot-key",
      model: "claude-sonnet-4.6",
      apiFormat: "anthropic-messages",
      maxOutputTokens: 103,
    },
    format: "anthropic-messages",
    url: "https://api.individual.githubcopilot.com/v1/messages",
    outputLimit: ["max_tokens", 103],
  },
  {
    name: "Copilot Anthropic Messages",
    input: {
      provider: "github-copilot",
      apiKey: "copilot-key",
      model: "copilot-model",
      baseUrl: "https://copilot.example",
      apiFormat: "anthropic-messages",
      maxOutputTokens: 103,
    },
    format: "anthropic-messages",
    url: "https://copilot.example/v1/messages",
    outputLimit: ["max_tokens", 103],
  },
  {
    name: "Copilot Anthropic Messages account prefix",
    input: {
      provider: "github-copilot",
      apiKey: "copilot-key",
      model: "claude-sonnet-4.6",
      baseUrl: "https://copilot.example/account",
      apiFormat: "anthropic-messages",
      maxOutputTokens: 103,
    },
    format: "anthropic-messages",
    url: "https://copilot.example/account/v1/messages",
    outputLimit: ["max_tokens", 103],
  },
  {
    name: "Copilot Anthropic Messages versioned prefix",
    input: {
      provider: "github-copilot",
      apiKey: "copilot-key",
      model: "claude-sonnet-4.6",
      baseUrl: "https://copilot.example/account/v1",
      apiFormat: "anthropic-messages",
      maxOutputTokens: 103,
    },
    format: "anthropic-messages",
    url: "https://copilot.example/account/v1/messages",
    outputLimit: ["max_tokens", 103],
  },
  {
    name: "Copilot Anthropic Messages full endpoint",
    input: {
      provider: "github-copilot",
      apiKey: "copilot-key",
      model: "claude-sonnet-4.6",
      baseUrl: "https://copilot.example/account/v1/messages",
      apiFormat: "anthropic-messages",
      maxOutputTokens: 103,
    },
    format: "anthropic-messages",
    url: "https://copilot.example/account/v1/messages",
    outputLimit: ["max_tokens", 103],
  },
  {
    name: "OpenRouter",
    input: { provider: "openrouter", apiKey: "openrouter-key", model: "router-model", maxOutputTokens: 104 },
    format: "chat-completions",
    url: "https://openrouter.ai/api/v1/chat/completions",
    outputLimit: ["max_tokens", 104],
  },
  {
    name: "xAI",
    input: { provider: "xai", apiKey: "xai-key", model: "grok-model", maxOutputTokens: 105 },
    format: "responses",
    url: "https://api.x.ai/v1/responses",
    outputLimit: ["max_output_tokens", 105],
  },
] as const satisfies readonly {
  readonly name: string;
  readonly input: ApiProviderInput;
  readonly format: ApiFormat;
  readonly url: string;
  readonly outputLimit: readonly [string, number];
}[];

describe("provider API-key routes", () => {
  for (const route of ROUTES) {
    test(`routes ${route.name} through its wire protocol`, async () => {
      const requests: Array<{
        readonly url: string;
        readonly headers: Headers;
        readonly body: Record<string, unknown>;
      }> = [];
      const fetchImpl: typeof fetch = Object.assign(
        async (url: RequestInfo | URL, init?: RequestInit) => {
          requests.push({
            url: String(url),
            headers: new Headers(init?.headers),
            body: JSON.parse(String(init?.body)),
          });
          expect(init?.redirect).toBe("error");
          return successfulStream(route.format);
        },
        { preconnect: fetch.preconnect },
      );
      const provider = createApiProvider(route.input, { fetchImpl });

      const output = await provider.stream(TEST_INPUT, () => undefined, new AbortController().signal);

      expect(output).toBe("wire-ok");
      expect(requests[0]?.url).toBe(route.url);
      expect(requests[0]?.headers.get("authorization")).toBe(`Bearer ${route.input.apiKey}`);
      expect(requests[0]?.body).toMatchObject({
        model: route.input.model,
        [route.outputLimit[0]]: route.outputLimit[1],
      });
      if (route.input.provider === "github-copilot") {
        expect(requests[0]?.headers.get("user-agent")).toBe("GitHubCopilotChat/0.35.0");
        expect(requests[0]?.headers.get("editor-version")).toBe("vscode/1.107.0");
        expect(requests[0]?.headers.get("editor-plugin-version")).toBe("copilot-chat/0.35.0");
        expect(requests[0]?.headers.get("copilot-integration-id")).toBe("vscode-chat");
        expect(requests[0]?.headers.get("x-initiator")).toBe("user");
        expect(requests[0]?.headers.get("openai-intent")).toBe("conversation-edits");
        if (route.format === "anthropic-messages") {
          expect(requests[0]?.headers.get("anthropic-version")).toBe("2023-06-01");
          expect(requests[0]?.headers.get("x-api-key")).toBeNull();
        }
      }
    });
  }
});
