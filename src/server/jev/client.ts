import { TypeSafeClient } from "@typesafe-ai/sdk";
import type { JevConnection } from "@/lib/ai-settings";
import { storedAiSettings } from "@/server/setup/settings";

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
  const saved = await storedAiSettings();
  // A setup/settings opt-out wins over ambient credentials inherited by the server.
  if (saved !== null) return saved.jev ? createJevClient(saved.jev) : null;
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
