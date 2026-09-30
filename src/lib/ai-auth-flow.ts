import { localizedIssue } from "@/lib/i18n/validation";
import { authFlowIssueCopy } from "@/lib/i18n/ai-validation-copy";
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
    context.addIssue({ code: "custom", path: ["enterpriseDomain"], ...localizedIssue(authFlowIssueCopy.copilotDomainOnly) });
  }
});
export type AuthStartInput = z.infer<typeof AuthStartInputSchema>;

// Accept the displayed Google authorization code, never a callback URL.
export const AuthCodeInputSchema = AuthScopeInputSchema.extend({
  code: z.string().trim().min(1).max(4096).regex(/^[A-Za-z0-9._~+/-]+$/),
}).strict();

export const AuthAttemptStatusSchema = z.enum(["starting", "pending", "ready", "denied", "expired", "failed"]);
export type AuthAttemptStatus = z.infer<typeof AuthAttemptStatusSchema>;
export type AuthAttemptView = {
  readonly id: string;
  readonly provider: z.infer<typeof WebAuthProviderSchema>;
  readonly status: AuthAttemptStatus;
  readonly expiresAt: number;
  readonly verificationUrl?: string;
  readonly userCode?: string;
  readonly requiresCode?: boolean;
  readonly retryAfterMs?: number;
};
