import { z } from "zod";
import type { WebAuthProvider } from "@/lib/ai-auth";

const JsonObjectSchema = z.record(z.string(), z.unknown());
const SafeErrorCodeSchema = z.string().regex(/^[a-z0-9_]{1,64}$/);

export class OAuthProtocolError extends Error {
  readonly name = "OAuthProtocolError";

  constructor(
    readonly provider: WebAuthProvider,
    readonly operation: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(`${provider} OAuth ${operation} failed${status === undefined ? "" : ` (HTTP ${status})`}`);
  }
}

export type JsonResponse = {
  readonly ok: boolean;
  readonly status: number;
  readonly body: Readonly<Record<string, unknown>>;
};

type JsonRequest = {
  readonly provider: WebAuthProvider;
  readonly operation: string;
  readonly url: string;
  readonly init: RequestInit;
  readonly fetchImpl?: typeof fetch;
  readonly signal?: AbortSignal;
};

export async function requestJson(input: JsonRequest): Promise<JsonResponse> {
  input.signal?.throwIfAborted();
  const timeout = AbortSignal.timeout(15_000);
  const signal = input.signal ? AbortSignal.any([input.signal, timeout]) : timeout;

  let response: Response;
  try {
    response = await (input.fetchImpl ?? fetch)(input.url, {
      ...input.init,
      redirect: "error",
      signal,
    });
  } catch {
    input.signal?.throwIfAborted();
    throw new OAuthProtocolError(input.provider, input.operation);
  }

  let rawBody: unknown;
  try {
    if (!response.body) throw new Error("Missing OAuth response body");
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let text = "";
    let bytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 65_536) throw new Error("OAuth response exceeds the size limit");
        text += decoder.decode(value, { stream: true });
      }
      rawBody = JSON.parse(text + decoder.decode());
    } finally {
      try { await reader.cancel(); } finally { reader.releaseLock(); }
    }
  } catch {
    input.signal?.throwIfAborted();
    throw new OAuthProtocolError(input.provider, `${input.operation}: malformed response`, response.status);
  }

  const parsedBody = JsonObjectSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    throw new OAuthProtocolError(input.provider, `${input.operation}: malformed response`, response.status);
  }

  return {
    ok: response.ok,
    status: response.status,
    body: parsedBody.data,
  };
}

export function responseError(
  provider: WebAuthProvider,
  operation: string,
  response: JsonResponse,
): OAuthProtocolError {
  const parsedCode = SafeErrorCodeSchema.safeParse(response.body.error);
  return new OAuthProtocolError(
    provider,
    operation,
    response.status,
    parsedCode.success ? parsedCode.data : undefined,
  );
}
