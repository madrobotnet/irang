import { TypeSafeClient } from "@typesafe-ai/sdk";
import type { JevConnection } from "@/lib/ai-settings";
import { aiSelection } from "@/server/setup/ai-profile-store";
import { resolvedJevConnection } from "@/server/setup/ai-profile-resolve";

/**
 * Optional TypeSafe Jev access. Every caller MUST treat null (not configured) and
 * thrown errors as "no judgment" and continue: Jev never blocks a user action.
 */
type SystemOne = Pick<TypeSafeClient, "systemOne">;

let override: SystemOne | null | undefined;

export function setJevForTests(client: SystemOne | null | undefined): void {
  override = client;
}

export function createJevClient(
  connection: JevConnection,
  fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>,
): TypeSafeClient {
  return new TypeSafeClient({
    apiKey: connection.apiKey,
    baseURL: connection.provider === "openrouter" ? "https://openrouter.ai/api" : "https://api.typesafe.ai",
    defaultModel: connection.model,
    timeout: 10_000,
    retry: { maxRetries: 0 },
    logLevel: "off",
    ...(fetchImpl ? { fetch: fetchImpl } : {}),
  });
}

export async function getJev(): Promise<SystemOne | null> {
  if (override !== undefined) return override;
  const selected = await aiSelection("jev");
  // A setup/settings opt-out wins over ambient credentials inherited by the server.
  if (selected.source === "disabled") return null;
  if (selected.source === "profile") {
    if (selected.profile.purpose !== "jev") return null;
    const connection = resolvedJevConnection(selected.profile.connection);
    return connection ? createJevClient(connection) : null;
  }
  const apiKey = process.env.TYPESAFE_API_KEY?.trim();
  if (apiKey) {
    return new TypeSafeClient({
      apiKey,
      defaultModel: process.env.TYPESAFE_JEV_MODEL?.trim() || "jev-latest",
      timeout: 10_000,
      retry: { maxRetries: 0 },
      logLevel: "off",
    });
  }
  return null;
}
