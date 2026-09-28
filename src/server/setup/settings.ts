import {
  ChatConnectionSchema,
  JevConnectionSchema,
  StoredAiSettingsSchema,
  type AiSettingsInput,
  type AiSettingsView,
  type JevConnection,
  type StoredAiSettings,
} from "@/lib/ai-settings";
import { queryOne, tx } from "@/server/db";
import { ApiError } from "@/server/http";
import { loadCodexAuth } from "@/server/chat/auth";

/** The database is private server storage; only redacted metadata leaves this module. */
export async function storedAiSettings(): Promise<StoredAiSettings | null> {
  const row = await queryOne<{ ai: unknown }>("SELECT ai FROM installation_settings WHERE singleton");
  return row ? StoredAiSettingsSchema.parse(row.ai) : null;
}

/** Only known provider endpoints can be carried into a saved UI configuration. */
function legacyJevConnection(): JevConnection | null {
  const apiKey = process.env.TYPESAFE_API_KEY?.trim();
  const base = process.env.TYPESAFE_BASE_URL?.replace(/\/$/, "") || "https://api.typesafe.ai";
  if (!apiKey || !["https://api.typesafe.ai", "https://openrouter.ai/api"].includes(base)) return null;
  return {
    provider: base === "https://openrouter.ai/api" ? "openrouter" : "typesafe",
    model: process.env.TYPESAFE_JEV_MODEL?.trim() || "jev-latest",
    apiKey,
  };
}

export function resolveAiSettings(input: AiSettingsInput, previous: StoredAiSettings | null): StoredAiSettings {
  let chat: StoredAiSettings["chat"] = null;
  if (input.chat) {
    if (!input.chatConsent) throw new ApiError("validation", "AI 데이터 전송 동의가 필요합니다.");
    switch (input.chat.mode) {
      case "api": {
        const previousKey = previous?.chat?.mode === "api" && previous.chat.provider === input.chat.provider
          ? previous.chat.apiKey : undefined;
        const apiKey = input.chat.apiKey ?? previousKey;
        if (!apiKey) throw new ApiError("validation", "선택한 제공자의 API 키를 입력해 주세요.");
        chat = ChatConnectionSchema.parse({ ...input.chat, apiKey });
        break;
      }
      case "auth":
        chat = input.chat;
        break;
      default: {
        const exhaustive: never = input.chat;
        return exhaustive;
      }
    }
  }
  let jev: StoredAiSettings["jev"] = null;
  if (input.jev) {
    const previousKey = previous?.jev?.provider === input.jev.provider ? previous.jev.apiKey : undefined;
    const apiKey = input.jev.apiKey ?? previousKey;
    if (!apiKey || !input.jevConsent) {
      throw new ApiError("validation", "선택한 Jev 제공자의 API 키와 데이터 전송 동의가 필요합니다.");
    }
    jev = JevConnectionSchema.parse({ ...input.jev, apiKey });
  }
  return { chat, jev };
}

export async function aiSettingsView(): Promise<AiSettingsView> {
  const saved = await storedAiSettings();
  const chat = saved?.chat ?? null;
  const legacyChat = saved === null && (await loadCodexAuth()).kind === "chatgpt";
  const legacyJev = saved === null ? legacyJevConnection() : null;
  const jev = saved === null ? legacyJev : saved.jev;
  return {
    chat: chat ? {
      provider: chat.provider,
      mode: chat.mode,
      model: chat.model,
      hasApiKey: chat.mode === "api",
    } : legacyChat ? {
      provider: "openai", mode: "auth", model: process.env.CODEX_MODEL?.trim() || "gpt-5.4-mini", hasApiKey: false,
    } : null,
    jev: jev ? { provider: jev.provider, model: jev.model, hasApiKey: true } : null,
    jevManagedByEnvironment: legacyJev !== null,
    chatManagedByEnvironment: legacyChat,
  };
}

export async function saveAiSettings(input: AiSettingsInput): Promise<void> {
  await tx(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(7431003)");
    const owner = await client.query<{ id: string }>("SELECT id FROM users ORDER BY created_at, id LIMIT 1");
    const user = owner.rows[0];
    if (!user) throw new ApiError("conflict", "최초 설정을 먼저 완료해 주세요.");
    const result = await client.query<{ ai: unknown }>("SELECT ai FROM installation_settings WHERE singleton");
    const row = result.rows[0];
    const previous = row ? StoredAiSettingsSchema.parse(row.ai) : { chat: null, jev: legacyJevConnection() };
    const ai = resolveAiSettings(input, previous);
    await client.query(
      `INSERT INTO installation_settings (singleton, owner_id, ai) VALUES (true, $1, $2::jsonb)
       ON CONFLICT (singleton) DO UPDATE SET ai = EXCLUDED.ai, updated_at = now()`,
      [user.id, JSON.stringify(ai)],
    );
  });
}
