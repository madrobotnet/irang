import { createAnthropicApiProvider } from "./api-provider-anthropic";
import { createGoogleApiProvider } from "./api-provider-google";
import { createOpenAiApiProvider } from "./api-provider-openai";
import type { ApiAdapterConfig } from "./api-provider-shared";
import { ChatProviderError, type ChatProvider } from "./provider";

type ApiProviderInput = {
  readonly provider: "openai" | "anthropic" | "google";
  readonly apiKey: string;
  readonly model: string;
};

type ApiProviderOptions = {
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
};

export function createApiProvider(
  input: ApiProviderInput,
  options: ApiProviderOptions = {},
): ChatProvider {
  const apiKey = input.apiKey.trim();
  const model = input.model.trim();
  const timeoutMs = options.timeoutMs ?? 60_000;
  if (!apiKey || !model || !Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new ChatProviderError();
  }
  const config: ApiAdapterConfig = {
    apiKey,
    model,
    fetchImpl: options.fetchImpl ?? fetch,
    timeoutMs,
  };

  switch (input.provider) {
    case "openai":
      return createOpenAiApiProvider(config);
    case "anthropic":
      return createAnthropicApiProvider(config);
    case "google":
      return createGoogleApiProvider(config);
    default: {
      const unsupported: never = input.provider;
      void unsupported;
      throw new ChatProviderError();
    }
  }
}
