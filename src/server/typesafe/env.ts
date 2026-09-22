const DEV_KEY_ENV = "TYPESAFE_API_KEY";
const PROD_KEY_ENV = "TYPESAFE_PROD_API_KEY";

function trimKey(raw: string | undefined): string | null {
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Dev key as stored. Production calls use `resolveTypesafeApiKey`. */
export function typesafeApiKeyFromEnv(): string | null {
  return trimKey(process.env[DEV_KEY_ENV]);
}

/**
 * Dev uses TYPESAFE_API_KEY. Production uses TYPESAFE_PROD_API_KEY only.
 * Identical dev and prod values are refused. The raw key is never returned to clients.
 */
export function resolveTypesafeApiKey(env: NodeJS.ProcessEnv = process.env): string | null {
  const dev = trimKey(env[DEV_KEY_ENV]);
  const prod = trimKey(env[PROD_KEY_ENV]);
  if (dev && prod && dev === prod) {
    return null;
  }
  if (env.NODE_ENV === "production") {
    return prod;
  }
  return dev;
}

export function isTypesafeConfigured(): boolean {
  return resolveTypesafeApiKey() !== null;
}
