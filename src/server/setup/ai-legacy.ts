import type { ChatConnection, JevConnection } from "@/lib/ai-settings";
import { loadCodexAuth } from "@/server/chat/auth";

export async function legacyChatConnection(): Promise<ChatConnection | null> {
  return (await loadCodexAuth()).kind === "chatgpt"
    ? { mode: "auth", provider: "openai", model: process.env.CODEX_MODEL?.trim() || "gpt-5.4-mini" }
    : null;
}

/** Unknown legacy endpoints remain environment-managed, never relabelled. */
export function legacyJevConnection(): JevConnection | null {
  const apiKey = process.env.TYPESAFE_API_KEY?.trim();
  const base = process.env.TYPESAFE_BASE_URL?.replace(/\/$/, "") || "https://api.typesafe.ai";
  if (!apiKey || !["https://api.typesafe.ai", "https://openrouter.ai/api"].includes(base)) return null;
  return {
    provider: base === "https://openrouter.ai/api" ? "openrouter" : "typesafe",
    model: process.env.TYPESAFE_JEV_MODEL?.trim() || "jev-latest",
    apiKey,
  };
}
