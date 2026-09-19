import { JevClientError } from "./errors";
import { jevConfigFromEnv, type JevEnvConfig } from "./env";
import type { SystemOneRequest, SystemOneResponse } from "./types";

export type JevClient = {
  /**
   * System One judgment call. Rex replaces the seat stub with SDK/HTTP sink.
   * Missing `TYPESAFE_API_KEY` → `missing_api_key` (no silent fallback).
   */
  systemOne(request: SystemOneRequest): Promise<SystemOneResponse>;
};

export type CreateJevClientOptions = {
  config?: JevEnvConfig;
};

function assertApiKey(config: JevEnvConfig): string {
  if (!config.apiKey) {
    throw new JevClientError(
      "missing_api_key",
      "TYPESAFE_API_KEY is not set; Jev judgments are unavailable",
    );
  }
  return config.apiKey;
}

/**
 * Thin integration seat — no SDK soak, no note routing judgments yet.
 */
export function createJevClient(
  options: CreateJevClientOptions = {},
  env: NodeJS.ProcessEnv = process.env,
): JevClient {
  const config = options.config ?? jevConfigFromEnv(env);

  return {
    async systemOne(_request: SystemOneRequest): Promise<SystemOneResponse> {
      assertApiKey(config);
      throw new JevClientError(
        "seat_not_wired",
        "Jev System One sink is not wired on this client seat (Rex SDK follow-up)",
      );
    },
  };
}
