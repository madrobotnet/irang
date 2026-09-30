import type { ProviderInput } from "./provider";
import { ChatProviderError } from "./provider";
import { groundedQuestion as localizedGroundedQuestion, groundingInstructions } from "@/server/i18n/copy";

export type ApiAdapterConfig = {
  readonly apiKey: string;
  readonly model: string;
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly maxOutputTokens?: number;
  readonly fetchImpl: typeof fetch;
  readonly timeoutMs: number;
};

type ApiRequest = {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
  readonly signal: AbortSignal;
  readonly fetchImpl: typeof fetch;
};

export function groundedQuestion(input: ProviderInput): string {
  return localizedGroundedQuestion(input.locale ?? "ko", input.question, input.sources);
}

export const groundingInstruction = (input: ProviderInput): string => groundingInstructions(input.locale ?? "ko");

export function requestSignal(outerSignal: AbortSignal, timeoutMs: number): AbortSignal {
  return AbortSignal.any([outerSignal, AbortSignal.timeout(timeoutMs)]);
}

export async function postApiStream(request: ApiRequest): Promise<ReadableStream<Uint8Array>> {
  let response: Response;
  try {
    response = await request.fetchImpl(request.url, {
      method: "POST",
      headers: request.headers,
      body: request.body,
      signal: request.signal,
      redirect: "error",
    });
  } catch {
    throw new ChatProviderError();
  }
  if (!response.ok || !response.body) throw new ChatProviderError();
  return response.body;
}
