import { z } from "zod";
import type { AuthProtocolOptions, OAuthCredential } from "@/lib/ai-auth";
import { OAuthProtocolError, requestJson, responseError } from "./http";

const AUTHORIZE_URL = "https://openrouter.ai/auth";
const TOKEN_URL = "https://openrouter.ai/api/v1/auth/keys";
const KeyResponseSchema = z.object({ key: z.string().min(1) });
const PkceValueSchema = z.string().regex(/^[A-Za-z0-9_-]{43,128}$/);

export function openRouterAuthorizationUrl(input: {
  readonly callbackUrl: string;
  readonly challenge: string;
}): string {
  if (!URL.canParse(input.callbackUrl) || !PkceValueSchema.safeParse(input.challenge).success) {
    throw new OAuthProtocolError("openrouter", "authorization request validation");
  }
  const callback = new URL(input.callbackUrl);
  if (callback.protocol !== "https:" && callback.protocol !== "http:") {
    throw new OAuthProtocolError("openrouter", "authorization request validation");
  }
  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    callback_url: callback.href,
    code_challenge: input.challenge,
    code_challenge_method: "S256",
  }).toString();
  return url.toString();
}

export async function exchangeOpenRouterCode(
  input: { readonly code: string; readonly verifier: string },
  options: AuthProtocolOptions,
): Promise<OAuthCredential> {
  if (input.code.length === 0 || !PkceValueSchema.safeParse(input.verifier).success) {
    throw new OAuthProtocolError("openrouter", "key exchange request validation");
  }
  const response = await requestJson({
    provider: "openrouter",
    operation: "key exchange",
    url: TOKEN_URL,
    init: {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code: input.code,
        code_verifier: input.verifier,
        code_challenge_method: "S256",
      }),
    },
    fetchImpl: options.fetchImpl,
    signal: options.signal,
  });
  if (!response.ok) throw responseError("openrouter", "key exchange", response);

  const parsed = KeyResponseSchema.safeParse(response.body);
  if (!parsed.success) {
    throw new OAuthProtocolError("openrouter", "key exchange response validation", response.status);
  }
  return {
    provider: "openrouter",
    accessToken: parsed.data.key,
  };
}
