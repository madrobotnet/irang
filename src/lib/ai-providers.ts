import { z } from "zod";

/**
 * `name` is a language-neutral product name. The server also stores it as the default
 * connection name, so it is never translated; localized option labels live in feature copy.
 */
export const AI_PROVIDERS = [
  { id: "openai", name: "ChatGPT / OpenAI", model: "gpt-6.1-sol", supportsAuth: true },
  { id: "anthropic", name: "Claude", model: "claude-sonnet-5-5", supportsAuth: false },
  { id: "google", name: "Gemini", model: "gemini-3.8-flash", supportsAuth: true },
  { id: "github-copilot", name: "GitHub Copilot", model: "gpt-6-luna", supportsAuth: true },
  { id: "openrouter", name: "OpenRouter", model: "openai/gpt-6.1-sol", supportsAuth: true },
  { id: "xai", name: "xAI / Grok", model: "grok-4.7", supportsAuth: true },
  { id: "openai-compatible", name: "OpenAI Compatible", model: "", supportsAuth: false },
  { id: "anthropic-compatible", name: "Anthropic Compatible", model: "", supportsAuth: false },
] as const;

export const JEV_PROVIDERS = [
  { id: "typesafe", name: "TypeSafe", model: "jev-latest", supportsAuth: false },
  { id: "openrouter", name: "OpenRouter", model: "~typesafe/jev-latest", supportsAuth: true },
] as const;

export const AiProviderSchema = z.enum([
  "openai", "anthropic", "google", "github-copilot", "openrouter", "xai",
  "openai-compatible", "anthropic-compatible",
]);
export type AiProvider = z.infer<typeof AiProviderSchema>;
export const JevProviderSchema = z.enum(["typesafe", "openrouter"]);
export type JevProvider = z.infer<typeof JevProviderSchema>;
export const ConnectionPurposeSchema = z.enum(["chat", "jev"]);
export type ConnectionPurpose = z.infer<typeof ConnectionPurposeSchema>;

export function isCustomProvider(provider: AiProvider): boolean {
  return provider === "openai-compatible" || provider === "anthropic-compatible";
}
