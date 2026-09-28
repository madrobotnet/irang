import { z } from "zod";
import { WebAuthProviderSchema } from "./ai-auth";

export const AuthScopeInputSchema = z.object({
  setupToken: z.string().min(32).max(256).optional(),
}).strict();

export const AuthStartInputSchema = AuthScopeInputSchema.extend({
  provider: WebAuthProviderSchema,
  enterpriseDomain: z.string().trim().toLowerCase().min(1).max(253)
    .regex(/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/).optional(),
}).strict().superRefine((value, context) => {
  if (value.enterpriseDomain && value.provider !== "github-copilot") {
    context.addIssue({ code: "custom", path: ["enterpriseDomain"], message: "기업 도메인은 GitHub Copilot에서만 사용합니다." });
  }
});
export type AuthStartInput = z.infer<typeof AuthStartInputSchema>;

export const AuthAttemptStatusSchema = z.enum(["starting", "pending", "ready", "denied", "expired", "failed"]);
export type AuthAttemptStatus = z.infer<typeof AuthAttemptStatusSchema>;
export type AuthAttemptView = {
  readonly id: string;
  readonly provider: z.infer<typeof WebAuthProviderSchema>;
  readonly status: AuthAttemptStatus;
  readonly expiresAt: number;
  readonly verificationUrl?: string;
  readonly userCode?: string;
  readonly retryAfterMs?: number;
};
