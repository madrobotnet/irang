export type JevEnvConfig = {
  apiKey: string | null;
  model: string;
};

function trimOrNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Reads `TYPESAFE_API_KEY` (never log or commit the value). */
export function jevConfigFromEnv(env: NodeJS.ProcessEnv = process.env): JevEnvConfig {
  return {
    apiKey: trimOrNull(env.TYPESAFE_API_KEY),
    model: trimOrNull(env.TYPESAFE_JEV_MODEL) ?? "jev-latest",
  };
}

export function isJevConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return jevConfigFromEnv(env).apiKey !== null;
}
