import { localizedIssue } from "@/lib/i18n/validation";
import { connectionIssueCopy } from "@/lib/i18n/ai-validation-copy";
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
    context.addIssue({ code: "custom", path: ["baseUrl"], ...localizedIssue(connectionIssueCopy.baseUrlRequired) });
  }
  if (!custom && (input.baseUrl !== undefined || input.headers !== undefined)) {
    context.addIssue({ code: "custom", path: ["baseUrl"], ...localizedIssue(connectionIssueCopy.customOnly) });
  }
  if (!custom && input.apiKey === "") {
    context.addIssue({ code: "custom", path: ["apiKey"], ...localizedIssue(connectionIssueCopy.apiKeyRequired) });
  }
  if (input.apiFormat && !custom && input.provider !== "github-copilot") {
    context.addIssue({ code: "custom", path: ["apiFormat"], ...localizedIssue(connectionIssueCopy.fixedApiFormat) });
  }
  if (input.provider === "anthropic-compatible" && input.apiFormat && input.apiFormat !== "anthropic-messages") {
    context.addIssue({ code: "custom", path: ["apiFormat"], ...localizedIssue(connectionIssueCopy.anthropicFormat) });
  }
  if (input.provider === "openai-compatible" && input.apiFormat === "anthropic-messages") {
    context.addIssue({ code: "custom", path: ["apiFormat"], ...localizedIssue(connectionIssueCopy.openAiFormat) });
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
    context.addIssue({ code: "custom", ...localizedIssue(connectionIssueCopy.copilotOnly) });
  }
  if ("credential" in input && input.credential && input.credential.provider !== input.provider) {
    context.addIssue({ code: "custom", path: ["credential"], ...localizedIssue(connectionIssueCopy.credentialMismatch) });
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
  apiKey: ApiKeySchema.refine((key) => key.length > 0, localizedIssue(connectionIssueCopy.jevApiKeyRequired)),
}).strict();
export type JevConnection = z.infer<typeof JevConnectionSchema>;

const JevApiInput = JevConnectionSchema.extend({
  mode: z.literal("api").optional(),
  apiKey: ApiKeySchema.refine((key) => key.length > 0, localizedIssue(connectionIssueCopy.jevApiKeyRequired)).optional(),
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
