import { z } from "zod";
import { OAuthCredentialSchema } from "./ai-auth";
import { AiProviderSchema, isCustomProvider, JevProviderSchema } from "./ai-providers";
import { ApiKeySchema, ApiOptionsShape, ApiFormatSchema, ModelSchema } from "./ai-provider-options";

const ApiDraft = z.object({
  mode: z.literal("api"),
  provider: AiProviderSchema,
  model: ModelSchema,
  apiKey: ApiKeySchema.optional(),
  ...ApiOptionsShape,
}).strict();

function validateApi(input: z.infer<typeof ApiDraft>, context: z.RefinementCtx): void {
  const custom = isCustomProvider(input.provider);
  if (custom && !input.baseUrl) {
    context.addIssue({ code: "custom", path: ["baseUrl"], message: "API 기본 URL을 입력해 주세요." });
  }
  if (!custom && (input.baseUrl !== undefined || input.headers !== undefined)) {
    context.addIssue({ code: "custom", path: ["baseUrl"], message: "사용자 지정 주소·헤더는 Compatible 연결에서 설정해 주세요." });
  }
  if (!custom && input.apiKey === "") {
    context.addIssue({ code: "custom", path: ["apiKey"], message: "API 키를 입력해 주세요." });
  }
  if (input.apiFormat && !custom && input.provider !== "github-copilot") {
    context.addIssue({ code: "custom", path: ["apiFormat"], message: "이 제공자는 정해진 API 형식을 사용합니다." });
  }
  if (input.provider === "anthropic-compatible" && input.apiFormat && input.apiFormat !== "anthropic-messages") {
    context.addIssue({ code: "custom", path: ["apiFormat"], message: "Anthropic Messages 형식을 선택해 주세요." });
  }
  if (input.provider === "openai-compatible" && input.apiFormat === "anthropic-messages") {
    context.addIssue({ code: "custom", path: ["apiFormat"], message: "OpenAI 호환 API 형식을 선택해 주세요." });
  }
}

const AuthFields = {
  mode: z.literal("auth"),
  provider: z.enum(["openai", "google", "github-copilot", "openrouter", "xai"]),
  model: ModelSchema,
  apiFormat: ApiFormatSchema.optional(),
  enterpriseDomain: z.string().trim().toLowerCase().max(253).regex(/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/).optional(),
} as const;
const AuthDraft = z.object({ ...AuthFields, authAttemptId: z.uuid().optional() }).strict();
const StoredAuth = z.object({ ...AuthFields, credential: OAuthCredentialSchema.optional() }).strict();

function validateAuth(
  input: z.infer<typeof AuthDraft> | z.infer<typeof StoredAuth>,
  context: z.RefinementCtx,
): void {
  if (input.provider !== "github-copilot" && (input.apiFormat || input.enterpriseDomain)) {
    context.addIssue({ code: "custom", message: "API 형식과 기업 도메인은 Copilot 연결에서 설정해 주세요." });
  }
  if ("credential" in input && input.credential && input.credential.provider !== input.provider) {
    context.addIssue({ code: "custom", path: ["credential"], message: "제공자 인증 정보가 일치하지 않습니다." });
  }
}

export const ChatInputSchema = z.discriminatedUnion("mode", [
  ApiDraft.superRefine(validateApi),
  AuthDraft.superRefine(validateAuth),
]);
export type ChatInput = z.infer<typeof ChatInputSchema>;

export const ChatConnectionSchema = z.discriminatedUnion("mode", [
  ApiDraft.extend({ apiKey: ApiKeySchema }).superRefine(validateApi),
  StoredAuth.superRefine(validateAuth),
]);
export type ChatConnection = z.infer<typeof ChatConnectionSchema>;

// Preserve the existing resolved Jev client contract and legacy API payloads.
export const JevConnectionSchema = z.object({
  provider: JevProviderSchema,
  model: ModelSchema,
  apiKey: ApiKeySchema.refine((key) => key.length > 0, "Jev API 키를 입력해 주세요."),
}).strict();
export type JevConnection = z.infer<typeof JevConnectionSchema>;

const JevApiInput = JevConnectionSchema.extend({
  mode: z.literal("api").optional(),
  apiKey: ApiKeySchema.refine((key) => key.length > 0, "Jev API 키를 입력해 주세요.").optional(),
}).strict();
const JevAuthFields = { mode: z.literal("auth"), provider: z.literal("openrouter"), model: ModelSchema } as const;
export const JevInputSchema = z.union([
  JevApiInput,
  z.object({ ...JevAuthFields, authAttemptId: z.uuid().optional() }).strict(),
]);
export type JevInput = z.infer<typeof JevInputSchema>;

export const StoredJevConnectionSchema = z.union([
  JevConnectionSchema.extend({ mode: z.literal("api").optional() }).strict(),
  z.object({
    ...JevAuthFields,
    credential: OAuthCredentialSchema.refine((value) => value.provider === "openrouter").optional(),
  }).strict(),
]);
export type StoredJevConnection = z.infer<typeof StoredJevConnectionSchema>;
