import { baseUrlFromToken } from "@/server/ai-auth/github-copilot";
import { createAnthropicApiProvider } from "./api-provider-anthropic";
import { createChatCompletionsApiProvider } from "./api-provider-chat-completions";
import { createGoogleApiProvider } from "./api-provider-google";
import { createOpenAiApiProvider } from "./api-provider-openai";
import type { ApiAdapterConfig } from "./api-provider-shared";
import { ChatProviderError, type ChatProvider } from "./provider";

export type ApiFormat = "chat-completions" | "responses" | "anthropic-messages";
export type ApiProviderInput = {
  readonly provider: "openai" | "anthropic" | "google" | "github-copilot"
    | "openrouter" | "xai" | "openai-compatible" | "anthropic-compatible";
  readonly apiKey: string;
  readonly model: string;
  readonly baseUrl?: string;
  readonly apiFormat?: ApiFormat;
  readonly headers?: Readonly<Record<string, string>>;
  readonly maxOutputTokens?: number;
};

type ApiProviderOptions = {
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
};

const ENDPOINTS = {
  "chat-completions": "/chat/completions",
  responses: "/responses",
  "anthropic-messages": "/messages",
} as const satisfies Record<ApiFormat, string>;
const RESERVED_HEADERS = new Set([
  "host",
  "content-length",
  "connection",
  "transfer-encoding",
  "cookie",
]);
const COPILOT_HEADERS = {
  "user-agent": "GitHubCopilotChat/0.35.0",
  "editor-version": "vscode/1.107.0",
  "editor-plugin-version": "copilot-chat/0.35.0",
  "copilot-integration-id": "vscode-chat",
  "x-initiator": "user",
  "openai-intent": "conversation-edits",
} as const;

function requestUrl(baseUrl: string, format: ApiFormat, rootUsesV1: boolean): string {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new ChatProviderError();
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new ChatProviderError();
  }
  const endpoint = ENDPOINTS[format];
  const path = url.pathname.replace(/\/+$/, "");
  const knownEndpoint = Object.values(ENDPOINTS).find((candidate) => path.endsWith(candidate));
  if (knownEndpoint && knownEndpoint !== endpoint) throw new ChatProviderError();
  if (!knownEndpoint) {
    url.pathname = path
      ? `${path}${endpoint}`
      : `${rootUsesV1 ? "/v1" : ""}${endpoint}`;
  }
  return url.toString();
}

function mergedHeaders(
  defaults: Readonly<Record<string, string>>,
  extras: Readonly<Record<string, string>> | undefined,
): Readonly<Record<string, string>> {
  const headers = new Headers(defaults);
  try {
    for (const [name, value] of Object.entries(extras ?? {})) {
      const normalizedName = name.toLowerCase();
      if (
        RESERVED_HEADERS.has(normalizedName)
        || /[\r\n]/.test(name)
        || /[\r\n]/.test(value)
      ) {
        throw new ChatProviderError();
      }
      headers.set(name, value);
    }
  } catch (error) {
    if (error instanceof ChatProviderError) throw error;
    throw new ChatProviderError();
  }
  return Object.fromEntries(headers.entries());
}

export function createApiProvider(
  input: ApiProviderInput,
  options: ApiProviderOptions = {},
): ChatProvider {
  const apiKey = input.apiKey.trim();
  const model = input.model.trim();
  const timeoutMs = options.timeoutMs ?? 60_000;
  const isCustom = input.provider === "openai-compatible" || input.provider === "anthropic-compatible";
  if (
    (!apiKey && !isCustom)
    || !model
    || !Number.isSafeInteger(timeoutMs)
    || timeoutMs <= 0
    || (input.maxOutputTokens !== undefined
      && (!Number.isSafeInteger(input.maxOutputTokens) || input.maxOutputTokens <= 0))
  ) {
    throw new ChatProviderError();
  }
  const credentialHeaders = (name: "authorization" | "x-api-key"): Readonly<Record<string, string>> =>
    apiKey ? { [name]: name === "authorization" ? `Bearer ${apiKey}` : apiKey } : {};
  let format: ApiFormat;
  let url: string;
  let defaults: Readonly<Record<string, string>>;

  switch (input.provider) {
    case "openai":
      if (input.apiFormat !== undefined && input.apiFormat !== "responses") throw new ChatProviderError();
      format = "responses";
      url = "https://api.openai.com/v1/responses";
      defaults = credentialHeaders("authorization");
      break;
    case "anthropic":
      if (input.apiFormat !== undefined && input.apiFormat !== "anthropic-messages") throw new ChatProviderError();
      format = "anthropic-messages";
      url = "https://api.anthropic.com/v1/messages";
      defaults = { ...credentialHeaders("x-api-key"), "anthropic-version": "2023-06-01" };
      break;
    case "google": {
      if (input.apiFormat !== undefined) throw new ChatProviderError();
      format = "responses";
      const googleModel = model.startsWith("models/") ? model.slice("models/".length) : model;
      url = `https://generativelanguage.googleapis.com/v1beta/models/${
        encodeURIComponent(googleModel)
      }:streamGenerateContent?alt=sse`;
      defaults = { "x-goog-api-key": apiKey };
      break;
    }
    case "github-copilot": {
      format = input.apiFormat ?? "responses";
      let base = input.baseUrl?.trim();
      if (!base) {
        base = baseUrlFromToken(apiKey);
        const host = new URL(base).hostname;
        // A manually supplied API token must not introduce arbitrary credential destinations.
        if (
          !host.endsWith(".githubcopilot.com") && !host.endsWith(".ghe.com")
          && host !== "copilot-proxy.githubusercontent.com"
        ) {
          throw new ChatProviderError();
        }
      }
      url = requestUrl(base, format, false);
      if (format === "anthropic-messages") {
        const path = new URL(base).pathname.replace(/\/+$/, "");
        // The Anthropic SDK uses /v1/messages under the Copilot account base.
        if (!path.endsWith("/messages") && !path.endsWith("/v1")) {
          url = requestUrl(`${base.replace(/\/+$/, "")}/v1`, format, false);
        }
      }
      defaults = { ...credentialHeaders("authorization"), ...COPILOT_HEADERS };
      break;
    }
    case "openrouter":
      if (input.apiFormat !== undefined && input.apiFormat !== "chat-completions") throw new ChatProviderError();
      format = "chat-completions";
      url = requestUrl("https://openrouter.ai/api/v1", format, false);
      defaults = credentialHeaders("authorization");
      break;
    case "xai":
      if (input.apiFormat !== undefined && input.apiFormat !== "responses") throw new ChatProviderError();
      format = "responses";
      url = requestUrl("https://api.x.ai/v1", format, false);
      defaults = credentialHeaders("authorization");
      break;
    case "openai-compatible":
      format = input.apiFormat ?? "chat-completions";
      if (format === "anthropic-messages" || !input.baseUrl?.trim()) throw new ChatProviderError();
      url = requestUrl(input.baseUrl.trim(), format, true);
      defaults = credentialHeaders("authorization");
      break;
    case "anthropic-compatible":
      format = input.apiFormat ?? "anthropic-messages";
      if (format !== "anthropic-messages" || !input.baseUrl?.trim()) throw new ChatProviderError();
      url = requestUrl(input.baseUrl.trim(), format, true);
      defaults = { ...credentialHeaders("x-api-key"), "anthropic-version": "2023-06-01" };
      break;
    default: {
      const unsupported: never = input.provider;
      void unsupported;
      throw new ChatProviderError();
    }
  }
  if (format === "anthropic-messages") {
    defaults = { "anthropic-version": "2023-06-01", ...defaults };
  }

  const config: ApiAdapterConfig = {
    apiKey,
    model,
    url,
    headers: mergedHeaders({ ...defaults, "content-type": "application/json" }, input.headers),
    ...(input.maxOutputTokens === undefined ? {} : { maxOutputTokens: input.maxOutputTokens }),
    fetchImpl: options.fetchImpl ?? fetch,
    timeoutMs,
  };

  if (input.provider === "google") return createGoogleApiProvider(config);
  switch (format) {
    case "responses":
      return createOpenAiApiProvider(config);
    case "anthropic-messages":
      return createAnthropicApiProvider(config);
    case "chat-completions":
      return createChatCompletionsApiProvider(config);
  }
}
