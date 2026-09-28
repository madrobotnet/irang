import { z } from "zod";

export const WebAuthProviderSchema = z.enum(["github-copilot", "openrouter", "xai"]);
export type WebAuthProvider = z.infer<typeof WebAuthProviderSchema>;

const TokenSchema = z.string().min(1).max(16_384);
const ExpiresAtSchema = z.number().nonnegative();
const HttpUrlSchema = z.url({ protocol: /^https?$/ }).refine((value) => {
  const url = new URL(value);
  return (url.protocol === "https:" || url.protocol === "http:")
    && url.username === ""
    && url.password === ""
    && url.search === ""
    && url.hash === "";
}, "Expected an absolute HTTP(S) URL without credentials, query, or fragment");

export const OAuthCredentialSchema = z.discriminatedUnion("provider", [
  z.object({
    provider: z.literal("github-copilot"),
    accessToken: TokenSchema,
    refreshToken: TokenSchema,
    expiresAt: ExpiresAtSchema.optional(),
    baseUrl: HttpUrlSchema.optional(),
    enterpriseDomain: z.string().trim().min(1).max(253).optional(),
  }).strict(),
  z.object({
    provider: z.literal("openrouter"),
    accessToken: TokenSchema,
  }).strict(),
  z.object({
    provider: z.literal("xai"),
    accessToken: TokenSchema,
    refreshToken: TokenSchema,
    expiresAt: ExpiresAtSchema.optional(),
  }).strict(),
]);
export type OAuthCredential = z.infer<typeof OAuthCredentialSchema>;

export type DeviceAuthorization = {
  readonly deviceCode: string;
  readonly userCode: string;
  readonly verificationUrl: string;
  readonly intervalSeconds: number;
  readonly expiresAt: number;
};

export type DevicePollResult =
  | { readonly status: "pending" | "slow_down"; readonly intervalSeconds?: number }
  | { readonly status: "denied" | "expired" }
  | { readonly status: "complete"; readonly credential: OAuthCredential };

export type AuthProtocolOptions = {
  readonly fetchImpl?: typeof fetch;
  readonly signal?: AbortSignal;
  readonly now?: () => number;
  readonly enterpriseDomain?: string;
};
