import { TypeSafeClient } from "@typesafe-ai/sdk";

/**
 * Optional TypeSafe Jev access. Every caller MUST treat null (not configured) and
 * thrown errors as "no judgment" and continue: Jev never blocks a user action.
 */
type SystemOne = Pick<TypeSafeClient, "systemOne">;

let override: SystemOne | null | undefined;

export function setJevForTests(client: SystemOne | null | undefined): void {
  override = client;
}

export function jevModel(): string {
  return process.env.TYPESAFE_JEV_MODEL?.trim() || "jev-latest";
}

export function getJev(): SystemOne | null {
  if (override !== undefined) return override;
  const apiKey = process.env.TYPESAFE_API_KEY?.trim();
  if (!apiKey) return null;
  return new TypeSafeClient({ apiKey });
}
