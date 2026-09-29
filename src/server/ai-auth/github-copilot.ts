import { z } from "zod";
import type {
  AuthProtocolOptions,
  DeviceAuthorization,
  DevicePollResult,
  OAuthCredential,
} from "@/lib/ai-auth";
import { OAuthProtocolError, requestJson, responseError } from "./http";

const CLIENT_ID = "Iv1.b507a08c87ecfe98";
const DEFAULT_INTERVAL_SECONDS = 5;
const COPILOT_HEADERS = {
  "User-Agent": "GitHubCopilotChat/0.35.0",
  "Editor-Version": "vscode/1.107.0",
  "Editor-Plugin-Version": "copilot-chat/0.35.0",
  "Copilot-Integration-Id": "vscode-chat",
} as const;

const DeviceResponseSchema = z.object({
  device_code: z.string().min(1),
  user_code: z.string().min(1),
  verification_uri: z.string().min(1),
  interval: z.number().positive().optional(),
  expires_in: z.number().positive(),
});
const TokenResponseSchema = z.object({
  access_token: z.string().min(1),
});
const CopilotTokenResponseSchema = z.object({
  token: z.string().min(1),
  expires_at: z.number().positive(),
});

function enterpriseDomain(value: string | undefined): string | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const candidate = value.includes("://") ? value : `https://${value}`;
  if (!URL.canParse(candidate)) {
    throw new OAuthProtocolError("github-copilot", "enterprise domain validation");
  }
  const url = new URL(candidate);
  if (url.protocol !== "https:" || url.hostname === "") {
    throw new OAuthProtocolError("github-copilot", "enterprise domain validation");
  }
  return url.hostname;
}

function urls(domain: string): {
  readonly device: string;
  readonly accessToken: string;
  readonly copilotToken: string;
} {
  return {
    device: `https://${domain}/login/device/code`,
    accessToken: `https://${domain}/login/oauth/access_token`,
    copilotToken: `https://api.${domain}/copilot_internal/v2/token`,
  };
}

function verificationUrl(value: string): string {
  if (!URL.canParse(value)) {
    throw new OAuthProtocolError("github-copilot", "device authorization response validation");
  }
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new OAuthProtocolError("github-copilot", "device authorization response validation");
  }
  return url.href;
}

export function baseUrlFromToken(token: string, domain?: string): string {
  const proxyHost = /(?:^|;)proxy-ep=([a-zA-Z0-9.-]+)(?:;|$)/.exec(token)?.[1];
  if (proxyHost !== undefined) {
    const apiHost = proxyHost.replace(/^proxy\./, "api.");
    const candidate = `https://${apiHost}`;
    if (URL.canParse(candidate) && new URL(candidate).hostname === apiHost) return candidate;
  }
  return domain === undefined
    ? "https://api.individual.githubcopilot.com"
    : `https://copilot-api.${domain}`;
}

async function exchangeCopilotToken(
  githubToken: string,
  domain: string | undefined,
  options: AuthProtocolOptions,
): Promise<OAuthCredential> {
  const response = await requestJson({
    provider: "github-copilot",
    operation: "Copilot token exchange",
    url: urls(domain ?? "github.com").copilotToken,
    init: {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${githubToken}`,
        ...COPILOT_HEADERS,
      },
    },
    fetchImpl: options.fetchImpl,
    signal: options.signal,
  });
  if (!response.ok) throw responseError("github-copilot", "Copilot token exchange", response);

  const parsed = CopilotTokenResponseSchema.safeParse(response.body);
  if (!parsed.success) {
    throw new OAuthProtocolError("github-copilot", "Copilot token exchange response validation", response.status);
  }
  return {
    provider: "github-copilot",
    accessToken: parsed.data.token,
    refreshToken: githubToken,
    expiresAt: parsed.data.expires_at * 1000,
    baseUrl: baseUrlFromToken(parsed.data.token, domain),
    ...(domain === undefined ? {} : { enterpriseDomain: domain }),
  };
}

export async function startGitHubCopilotDeviceAuthorization(
  options: AuthProtocolOptions,
): Promise<DeviceAuthorization> {
  const domain = enterpriseDomain(options.enterpriseDomain) ?? "github.com";
  const response = await requestJson({
    provider: "github-copilot",
    operation: "device authorization",
    url: urls(domain).device,
    init: {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": COPILOT_HEADERS["User-Agent"],
      },
      body: new URLSearchParams({ client_id: CLIENT_ID, scope: "read:user" }),
    },
    fetchImpl: options.fetchImpl,
    signal: options.signal,
  });
  if (!response.ok) throw responseError("github-copilot", "device authorization", response);

  const parsed = DeviceResponseSchema.safeParse(response.body);
  if (!parsed.success) {
    throw new OAuthProtocolError("github-copilot", "device authorization response validation", response.status);
  }
  return {
    deviceCode: parsed.data.device_code,
    userCode: parsed.data.user_code,
    verificationUrl: verificationUrl(parsed.data.verification_uri),
    intervalSeconds: parsed.data.interval ?? DEFAULT_INTERVAL_SECONDS,
    expiresAt: (options.now ?? Date.now)() + parsed.data.expires_in * 1000,
  };
}

export async function pollGitHubCopilotDeviceAuthorization(
  deviceCode: string,
  options: AuthProtocolOptions,
): Promise<DevicePollResult> {
  const domain = enterpriseDomain(options.enterpriseDomain);
  if (options.githubToken) {
    return {
      status: "complete",
      credential: await exchangeCopilotToken(options.githubToken, domain, options),
    };
  }
  const response = await requestJson({
    provider: "github-copilot",
    operation: "device token polling",
    url: urls(domain ?? "github.com").accessToken,
    init: {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": COPILOT_HEADERS["User-Agent"],
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        device_code: deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    },
    fetchImpl: options.fetchImpl,
    signal: options.signal,
  });

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
  if (!response.ok) throw responseError("github-copilot", "device token polling", response);

  const parsed = TokenResponseSchema.safeParse(response.body);
  if (!parsed.success) {
    throw new OAuthProtocolError("github-copilot", "device token response validation", response.status);
  }
  try {
    return {
      status: "complete",
      credential: await exchangeCopilotToken(parsed.data.access_token, domain, options),
    };
  } catch (error) {
    if (error instanceof OAuthProtocolError && error.retryable) {
      return { status: "slow_down", githubToken: parsed.data.access_token };
    }
    throw error;
  }
}

export function refreshGitHubCopilotCredential(
  credential: Extract<OAuthCredential, { readonly provider: "github-copilot" }>,
  options: AuthProtocolOptions,
): Promise<OAuthCredential> {
  return exchangeCopilotToken(
    credential.refreshToken,
    enterpriseDomain(credential.enterpriseDomain),
    options,
  );
}
