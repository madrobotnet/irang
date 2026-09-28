import type {
  AuthProtocolOptions,
  DeviceAuthorization,
  DevicePollResult,
  OAuthCredential,
} from "@/lib/ai-auth";
import {
  pollGitHubCopilotDeviceAuthorization,
  refreshGitHubCopilotCredential,
  startGitHubCopilotDeviceAuthorization,
} from "./github-copilot";
import {
  pollXaiDeviceAuthorization,
  refreshXaiCredential,
  startXaiDeviceAuthorization,
} from "./xai";
import { OAuthProtocolError } from "./http";

function assertNever(value: never): never {
  throw new TypeError(`Unsupported OAuth provider: ${String(value)}`);
}

export async function startDeviceAuthorization(
  provider: "github-copilot" | "xai",
  options: AuthProtocolOptions = {},
): Promise<DeviceAuthorization> {
  switch (provider) {
    case "github-copilot":
      return startGitHubCopilotDeviceAuthorization(options);
    case "xai":
      return startXaiDeviceAuthorization(options);
    default:
      return assertNever(provider);
  }
}

export async function pollDeviceAuthorization(
  provider: "github-copilot" | "xai",
  deviceCode: string,
  options: AuthProtocolOptions = {},
): Promise<DevicePollResult> {
  try {
    switch (provider) {
      case "github-copilot":
        return await pollGitHubCopilotDeviceAuthorization(deviceCode, options);
      case "xai":
        return await pollXaiDeviceAuthorization(deviceCode, options);
      default:
        return assertNever(provider);
    }
  } catch (error) {
    if (error instanceof OAuthProtocolError && error.retryable) return { status: "slow_down" };
    throw error;
  }
}

export async function refreshCredential(
  credential: OAuthCredential,
  options: AuthProtocolOptions = {},
): Promise<OAuthCredential> {
  switch (credential.provider) {
    case "github-copilot":
      return refreshGitHubCopilotCredential(credential, options);
    case "openrouter":
      return credential;
    case "xai":
      return refreshXaiCredential(credential, options);
    default:
      return assertNever(credential);
  }
}

export { OAuthProtocolError };
export { exchangeOpenRouterCode, openRouterAuthorizationUrl } from "./openrouter";
export { createPkce } from "./pkce";
