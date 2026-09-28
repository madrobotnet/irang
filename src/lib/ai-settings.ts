import { z } from "zod";

export const AI_PROVIDERS = [
  { id: "openai", name: "ChatGPT / OpenAI", model: "gpt-5.4-mini", supportsAuth: true },
  { id: "anthropic", name: "Claude", model: "claude-sonnet-4-6", supportsAuth: false },
  { id: "google", name: "Gemini", model: "gemini-2.5-flash", supportsAuth: true },
] as const;

export const JEV_PROVIDERS = [
  { id: "typesafe", name: "TypeSafe 공식", model: "jev-latest" },
  { id: "openrouter", name: "OpenRouter", model: "~typesafe/jev-latest" },
] as const;

export const AiProviderSchema = z.enum(["openai", "anthropic", "google"]);
export type AiProvider = z.infer<typeof AiProviderSchema>;
export const JevProviderSchema = z.enum(["typesafe", "openrouter"]);
export type JevProvider = z.infer<typeof JevProviderSchema>;

const Model = z.string().trim().min(1).max(160).regex(/^[a-zA-Z0-9._:~/-]+$/);
const ApiKey = z.string().trim().min(1).max(4096).regex(/^\S+$/);

export const ChatConnectionSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("api"), provider: AiProviderSchema, model: Model, apiKey: ApiKey }).strict(),
  z.object({ mode: z.literal("auth"), provider: z.enum(["openai", "google"]), model: Model }).strict(),
]);
export type ChatConnection = z.infer<typeof ChatConnectionSchema>;

const ChatInput = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("api"), provider: AiProviderSchema, model: Model, apiKey: ApiKey.optional() }).strict(),
  z.object({ mode: z.literal("auth"), provider: z.enum(["openai", "google"]), model: Model }).strict(),
]);

export const JevConnectionSchema = z.object({
  provider: JevProviderSchema,
  model: Model,
  apiKey: ApiKey,
}).strict();
export type JevConnection = z.infer<typeof JevConnectionSchema>;

export const AiSettingsInputSchema = z.object({
  chat: ChatInput.nullable(),
  chatConsent: z.boolean(),
  jev: JevConnectionSchema.extend({ apiKey: ApiKey.optional() }).nullable(),
  jevConsent: z.boolean(),
}).strict().superRefine((input, context) => {
  if (input.chat && !input.chatConsent) {
    context.addIssue({ code: "custom", path: ["chatConsent"], message: "선택한 AI 제공자에게 질문과 관련 노트를 보내는 데 동의해 주세요." });
  }
  if (input.jev && !input.jevConsent) {
    context.addIssue({ code: "custom", path: ["jevConsent"], message: "선택한 Jev 제공자에게 캡처 내용과 최근 노트 제목을 보내는 데 동의해 주세요." });
  }
});
export type AiSettingsInput = z.infer<typeof AiSettingsInputSchema>;

export const StoredAiSettingsSchema = z.object({
  chat: ChatConnectionSchema.nullable(),
  jev: JevConnectionSchema.nullable(),
}).strict();
export type StoredAiSettings = z.infer<typeof StoredAiSettingsSchema>;

/** Browser-safe metadata. Credentials are never returned by the settings API. */
export type AiSettingsView = {
  readonly chat: {
    readonly provider: AiProvider;
    readonly mode: "api" | "auth";
    readonly model: string;
    readonly hasApiKey: boolean;
  } | null;
  readonly jev: {
    readonly provider: JevProvider;
    readonly model: string;
    readonly hasApiKey: boolean;
  } | null;
  readonly jevManagedByEnvironment: boolean;
  readonly chatManagedByEnvironment: boolean;
};
