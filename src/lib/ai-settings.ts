import { z } from "zod";
import {
  ChatConnectionSchema, ChatInputSchema, JevConnectionSchema,
  JevInputSchema, StoredJevConnectionSchema,
} from "./ai-connections";
import type { AiProvider, JevProvider } from "./ai-providers";
import { ConnectionNameSchema, type ApiFormat } from "./ai-provider-options";

export { AI_PROVIDERS, JEV_PROVIDERS, AiProviderSchema, JevProviderSchema } from "./ai-providers";
export type { AiProvider, JevProvider } from "./ai-providers";
export { ChatConnectionSchema, JevConnectionSchema } from "./ai-connections";
export type { ChatConnection, JevConnection } from "./ai-connections";

const SavedSelection = z.object({ mode: z.literal("saved"), id: z.uuid() }).strict();
const EnvironmentSelection = z.object({ mode: z.literal("environment") }).strict();

export const AiSettingsInputSchema = z.object({
  chat: z.union([ChatInputSchema, SavedSelection, EnvironmentSelection]).nullable(),
  chatConsent: z.boolean(),
  jev: z.union([JevInputSchema, SavedSelection, EnvironmentSelection]).nullable(),
  jevConsent: z.boolean(),
  chatName: ConnectionNameSchema.optional(),
  jevName: ConnectionNameSchema.optional(),
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

export const ConnectionProfileInputSchema = z.discriminatedUnion("purpose", [
  z.object({ purpose: z.literal("chat"), name: ConnectionNameSchema, connection: ChatInputSchema, consent: z.literal(true) }).strict(),
  z.object({ purpose: z.literal("jev"), name: ConnectionNameSchema, connection: JevInputSchema, consent: z.literal(true) }).strict(),
]);
export type ConnectionProfileInput = z.infer<typeof ConnectionProfileInputSchema>;

export const ConnectionProfileSchema = z.discriminatedUnion("purpose", [
  z.object({ id: z.uuid(), name: ConnectionNameSchema, purpose: z.literal("chat"), connection: ChatConnectionSchema }).strict(),
  z.object({ id: z.uuid(), name: ConnectionNameSchema, purpose: z.literal("jev"), connection: StoredJevConnectionSchema }).strict(),
]);
export type ConnectionProfile = z.infer<typeof ConnectionProfileSchema>;

export const AiSettingsDocumentSchema = z.object({
  version: z.literal(2),
  chatId: z.union([z.uuid(), z.literal("environment")]).nullable(),
  jevId: z.union([z.uuid(), z.literal("environment")]).nullable(),
}).strict();
export type AiSettingsDocument = z.infer<typeof AiSettingsDocumentSchema>;

export function emptyAiSettingsDocument(): AiSettingsDocument {
  return { version: 2, chatId: null, jevId: null };
}

/** Browser-safe metadata. Credentials are never returned by the settings API. */
export type ChatConnectionView = {
  readonly provider: AiProvider;
  readonly mode: "api" | "auth";
  readonly model: string;
  readonly hasApiKey: boolean;
  readonly hasCredential?: boolean;
  readonly baseUrl?: string;
  readonly apiFormat?: ApiFormat;
  readonly maxOutputTokens?: number;
  readonly headerNames?: readonly string[];
  readonly enterpriseDomain?: string;
};
export type JevConnectionView = {
  readonly provider: JevProvider;
  readonly mode?: "api" | "auth";
  readonly model: string;
  readonly hasApiKey: boolean;
  readonly hasCredential?: boolean;
};
export type ConnectionProfileView =
  | { readonly id: string; readonly name: string; readonly purpose: "chat"; readonly connection: ChatConnectionView }
  | { readonly id: string; readonly name: string; readonly purpose: "jev"; readonly connection: JevConnectionView };

export type AiSettingsView = {
  readonly chat: ChatConnectionView | null;
  readonly jev: JevConnectionView | null;
  readonly profiles: readonly ConnectionProfileView[];
  readonly chatId: string | null;
  readonly jevId: string | null;
  readonly jevManagedByEnvironment: boolean;
  readonly chatManagedByEnvironment: boolean;
};
