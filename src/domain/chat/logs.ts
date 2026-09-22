const RAW_KEYS = new Set([
  "prompt",
  "codexPrompt",
  "response",
  "content",
  "body",
  "messages",
  "authorization",
  "apiKey",
]);

/** Drop raw prompt and response text. Ids and short scalars stay. */
export function maskAiLogPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const masked: Record<string, unknown> = { masked: true };
  for (const [key, value] of Object.entries(payload)) {
    if (RAW_KEYS.has(key)) {
      masked[key] = "[masked]";
      continue;
    }
    if (Array.isArray(value) && value.every((item) => typeof item === "string" || typeof item === "number")) {
      masked[key] = value;
      continue;
    }
    if (value !== null && typeof value === "object") {
      masked[key] = "[masked]";
      continue;
    }
    masked[key] = value;
  }
  return masked;
}
