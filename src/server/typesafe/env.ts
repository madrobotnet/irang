const API_KEY_ENV = "TYPESAFE_API_KEY";

export function typesafeApiKeyFromEnv(): string | null {
  const raw = process.env[API_KEY_ENV];
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isTypesafeConfigured(): boolean {
  return typesafeApiKeyFromEnv() !== null;
}
