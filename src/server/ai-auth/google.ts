import { randomBytes } from "node:crypto";
import { z } from "zod";
import { GoogleCredentialSchema, type AuthProtocolOptions, type GoogleCredential } from "@/lib/ai-auth";
import { OAuthProtocolError, requestJson, responseError } from "./http";

// Public installed-app credentials and manual flow from Gemini CLI v0.61.0:
// https://github.com/google-gemini/gemini-cli/blob/v0.61.0/packages/core/src/code_assist/oauth2.ts
const clientId = "681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com";
const clientSecret = "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";
const redirectUri = "https://codeassist.google.com/authcode";

export function googleAuthorizationUrl(challenge: string): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    // A new saved profile needs its own refresh grant, even after prior consent.
    client_id: clientId, redirect_uri: redirectUri, response_type: "code", access_type: "offline", prompt: "consent",
    scope: ["cloud-platform", "userinfo.email", "userinfo.profile"].map((scope) => `https://www.googleapis.com/auth/${scope}`).join(" "),
    code_challenge_method: "S256", code_challenge: challenge, state: randomBytes(32).toString("hex"),
  }).toString();
  return url.href;
}

export async function exchangeGoogleCode(
  input: { readonly code: string; readonly verifier: string }, options: AuthProtocolOptions,
): Promise<GoogleCredential> {
  const response = await requestJson({
    provider: "google", operation: "exchange", url: "https://oauth2.googleapis.com/token", ...options,
    init: {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "authorization_code",
        code: input.code, code_verifier: input.verifier, redirect_uri: redirectUri }),
    },
  });
  if (!response.ok) throw responseError("google", "exchange", response);
  const tokens = z.object({
    access_token: z.string(), refresh_token: z.string(), expires_in: z.number().positive(),
    id_token: z.string().optional(), scope: z.string().optional(), token_type: z.string().optional(),
  }).safeParse(response.body);
  if (!tokens.success) throw new OAuthProtocolError("google", "malformed tokens", response.status);
  const parsed = GoogleCredentialSchema.safeParse({
    provider: "google", accessToken: tokens.data.access_token, refreshToken: tokens.data.refresh_token,
    expiresAt: (options.now ?? Date.now)() + tokens.data.expires_in * 1000,
    idToken: tokens.data.id_token, scope: tokens.data.scope, tokenType: tokens.data.token_type,
  });
  if (!parsed.success) throw new OAuthProtocolError("google", "malformed tokens", response.status);
  return parsed.data;
}
