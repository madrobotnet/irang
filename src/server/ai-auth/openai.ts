import { z } from "zod";
import { OAuthCredentialSchema, type AuthProtocolOptions, type DeviceAuthorization, type OAuthCredential } from "@/lib/ai-auth";
import { OAuthProtocolError, requestJson, responseError } from "./http";

// https://github.com/openai/codex/blob/rust-v0.158.0/codex-rs/login/src/device_code_auth.rs
const clientId = "app_EMoamEEZ73f0CkXaXp7hrann";
const issuer = "https://auth.openai.com";
export const OpenAiCodeSchema = z.object({
  authorization_code: z.string().min(1).max(4096),
  code_verifier: z.string().min(1).max(4096),
  code_challenge: z.string().min(1).max(4096),
});
export type OpenAiCode = z.infer<typeof OpenAiCodeSchema>;
const JwtClaimsSchema = z.object({
  exp: z.number().nonnegative().optional(),
  "https://api.openai.com/auth": z.object({ chatgpt_account_id: z.string().min(1).max(256).optional() }).optional(),
});

function claims(token: string | undefined) {
  const encoded = token?.split(".")[1];
  if (!encoded) return undefined;
  try {
    const parsed = JwtClaimsSchema.safeParse(JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")));
    return parsed.success ? parsed.data : undefined;
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return undefined;
  }
}

function credentialFromTokens(body: unknown, options: AuthProtocolOptions, previous?: Extract<OAuthCredential, { provider: "openai" }>) {
  const parsed = z.object({
    access_token: z.string().min(1), refresh_token: z.string().min(1).optional(),
    id_token: z.string().min(1).optional(), expires_in: z.number().positive().optional(),
  }).safeParse(body);
  if (!parsed.success) throw new OAuthProtocolError("openai", "malformed tokens", 200);
  const tokens = parsed.data;
  const accountId = claims(tokens.id_token)?.["https://api.openai.com/auth"]?.chatgpt_account_id
    ?? claims(tokens.access_token)?.["https://api.openai.com/auth"]?.chatgpt_account_id ?? previous?.accountId;
  const expiresAt = tokens.expires_in === undefined ? (claims(tokens.access_token)?.exp ?? 0) * 1000
    : (options.now ?? Date.now)() + tokens.expires_in * 1000;
  const credential = OAuthCredentialSchema.safeParse({
    provider: "openai", accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? previous?.refreshToken, accountId, expiresAt,
  });
  if (!credential.success) throw new OAuthProtocolError("openai", "malformed tokens", 200);
  return credential.data;
}

export async function startOpenAiDeviceAuthorization(options: AuthProtocolOptions = {}): Promise<DeviceAuthorization> {
  const response = await requestJson({
    provider: "openai", operation: "start", url: `${issuer}/api/accounts/deviceauth/usercode`, ...options,
    init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ client_id: clientId }) },
  });
  if (!response.ok) throw responseError("openai", "start", response);
  const parsed = z.object({
    device_auth_id: z.string().min(1).max(4096),
    user_code: z.string().min(1).max(128).optional(), usercode: z.string().min(1).max(128).optional(),
    interval: z.coerce.number().int().nonnegative().max(3600).default(5),
  }).safeParse(response.body);
  if (!parsed.success || !(parsed.data.user_code ?? parsed.data.usercode)) {
    throw new OAuthProtocolError("openai", "malformed device authorization", response.status);
  }
  return {
    deviceCode: parsed.data.device_auth_id, userCode: parsed.data.user_code ?? parsed.data.usercode ?? "",
    verificationUrl: `${issuer}/codex/device`, intervalSeconds: Math.max(1, parsed.data.interval),
    expiresAt: (options.now ?? Date.now)() + 15 * 60_000,
  };
}

export async function pollOpenAiDeviceAuthorization(
  grant: { readonly deviceCode: string; readonly userCode: string }, options: AuthProtocolOptions,
): Promise<{ readonly status: "pending" | "denied" } | { readonly status: "code"; readonly code: OpenAiCode }> {
  try {
    const response = await requestJson({
      provider: "openai", operation: "poll", url: `${issuer}/api/accounts/deviceauth/token`, ...options,
      init: {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ device_auth_id: grant.deviceCode, user_code: grant.userCode }),
      },
    });
    if (response.status === 403 || response.status === 404) return { status: "pending" };
    const error = responseError("openai", "poll", response);
    const nestedError = z.object({ code: z.string() }).safeParse(response.body.error);
    if (response.status === 401 && (error.code === "authorization_declined"
      || (nestedError.success && nestedError.data.code === "authorization_declined"))) return { status: "denied" };
    if (!response.ok) throw error;
    const code = OpenAiCodeSchema.safeParse(response.body);
    if (!code.success) throw new OAuthProtocolError("openai", "malformed authorization code", response.status);
    return { status: "code", code: code.data };
  } catch (error) {
    // Pending is defined by HTTP status, even if the server sent no JSON body.
    if (error instanceof OAuthProtocolError && (error.status === 403 || error.status === 404)) return { status: "pending" };
    throw error;
  }
}

export async function exchangeOpenAiCode(code: OpenAiCode, options: AuthProtocolOptions): Promise<OAuthCredential> {
  // server.rs uses TokenEncoding::Form, not JSON, for the one-time exchange.
  const response = await requestJson({
    provider: "openai", operation: "exchange", url: `${issuer}/oauth/token`, ...options,
    init: {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", client_id: clientId,
        code: code.authorization_code, code_verifier: code.code_verifier, redirect_uri: `${issuer}/deviceauth/callback` }),
    },
  });
  if (!response.ok) throw responseError("openai", "exchange", response);
  return credentialFromTokens(response.body, options);
}

export async function refreshOpenAiCredential(
  credential: Extract<OAuthCredential, { provider: "openai" }>, options: AuthProtocolOptions,
): Promise<OAuthCredential> {
  const response = await requestJson({
    provider: "openai", operation: "refresh", url: `${issuer}/oauth/token`, ...options,
    init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      grant_type: "refresh_token", client_id: clientId, refresh_token: credential.refreshToken,
    }) },
  });
  if (!response.ok) throw responseError("openai", "refresh", response);
  return credentialFromTokens(response.body, options, credential);
}
