import { z } from "zod";
import type {
  AuthProtocolOptions,
  DeviceAuthorization,
  DevicePollResult,
  OAuthCredential,
} from "@/lib/ai-auth";
import { OAuthProtocolError, requestJson, responseError } from "./http";

const CLIENT_ID = "b1a00492-073a-47ea-816f-4c329264a828";
const SCOPE = "openid profile email offline_access grok-cli:access api:access";
const DEVICE_URL = "https://auth.x.ai/oauth2/device/code";
const TOKEN_URL = "https://auth.x.ai/oauth2/token";
const DEFAULT_INTERVAL_SECONDS = 5;
const DEFAULT_TOKEN_LIFETIME_SECONDS = 3600;

const DeviceResponseSchema = z.object({
  device_code: z.string().min(1),
  user_code: z.string().min(1),
  verification_uri: z.string().min(1),
  verification_uri_complete: z.string().min(1).optional(),
  interval: z.unknown().optional(),
  expires_in: z.number().positive(),
});
const TokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().positive().optional(),
});

function verificationUrl(value: string): string {
  if (!URL.canParse(value)) {
    throw new OAuthProtocolError("xai", "device authorization response validation");
  }
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new OAuthProtocolError("xai", "device authorization response validation");
  }
  return url.href;
}

function tokenCredential(
  body: Readonly<Record<string, unknown>>,
  previousRefreshToken: string | undefined,
  now: () => number,
  status: number,
): OAuthCredential {
  const parsed = TokenResponseSchema.safeParse(body);
  if (!parsed.success || (parsed.data.refresh_token === undefined && previousRefreshToken === undefined)) {
    throw new OAuthProtocolError("xai", "token response validation", status);
  }
  return {
    provider: "xai",
    accessToken: parsed.data.access_token,
    refreshToken: parsed.data.refresh_token ?? previousRefreshToken ?? "",
    expiresAt: now() + (parsed.data.expires_in ?? DEFAULT_TOKEN_LIFETIME_SECONDS) * 1000,
  };
}

function tokenRequest(
  fields: Readonly<Record<string, string>>,
  operation: string,
  options: AuthProtocolOptions,
) {
  return requestJson({
    provider: "xai",
    operation,
    url: TOKEN_URL,
    init: {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(fields),
    },
    fetchImpl: options.fetchImpl,
    signal: options.signal,
  });
}

export async function startXaiDeviceAuthorization(
  options: AuthProtocolOptions,
): Promise<DeviceAuthorization> {
  const response = await requestJson({
    provider: "xai",
    operation: "device authorization",
    url: DEVICE_URL,
    init: {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        scope: SCOPE,
        referrer: "pi",
      }),
    },
    fetchImpl: options.fetchImpl,
    signal: options.signal,
  });
  if (!response.ok) throw responseError("xai", "device authorization", response);

  const parsed = DeviceResponseSchema.safeParse(response.body);
  if (!parsed.success) {
    throw new OAuthProtocolError("xai", "device authorization response validation", response.status);
  }
  return {
    deviceCode: parsed.data.device_code,
    userCode: parsed.data.user_code,
    verificationUrl: verificationUrl(parsed.data.verification_uri_complete ?? parsed.data.verification_uri),
    intervalSeconds: typeof parsed.data.interval === "number"
      && Number.isFinite(parsed.data.interval)
      && parsed.data.interval > 0
      ? parsed.data.interval
      : DEFAULT_INTERVAL_SECONDS,
    expiresAt: (options.now ?? Date.now)() + parsed.data.expires_in * 1000,
  };
}

export async function pollXaiDeviceAuthorization(
  deviceCode: string,
  options: AuthProtocolOptions,
): Promise<DevicePollResult> {
  const response = await tokenRequest({
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    client_id: CLIENT_ID,
    device_code: deviceCode,
  }, "device token polling", options);

  if (response.ok) {
    return {
      status: "complete",
      credential: tokenCredential(response.body, undefined, options.now ?? Date.now, response.status),
    };
  }
  const error = response.body.error;
  if (error === "authorization_pending") return { status: "pending" };
  if (error === "slow_down") {
    const interval = response.body.interval;
    return {
      status: "slow_down",
      ...(typeof interval === "number" && Number.isFinite(interval) && interval > 0
        ? { intervalSeconds: interval }
        : {}),
    };
  }
  if (error === "access_denied" || error === "authorization_denied") return { status: "denied" };
  if (error === "expired_token") return { status: "expired" };
  throw responseError("xai", "device token polling", response);
}

export async function refreshXaiCredential(
  credential: Extract<OAuthCredential, { readonly provider: "xai" }>,
  options: AuthProtocolOptions,
): Promise<OAuthCredential> {
  const response = await tokenRequest({
    grant_type: "refresh_token",
    client_id: CLIENT_ID,
    refresh_token: credential.refreshToken,
  }, "token refresh", options);
  if (!response.ok) throw responseError("xai", "token refresh", response);
  return tokenCredential(
    response.body,
    credential.refreshToken,
    options.now ?? Date.now,
    response.status,
  );
}
