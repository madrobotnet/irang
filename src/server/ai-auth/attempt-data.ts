import { z } from "zod";
import type { PoolClient } from "pg";
import { WebAuthProviderSchema, type WebAuthProvider } from "@/lib/ai-auth";
import { AuthAttemptStatusSchema, type AuthAttemptStatus, type AuthAttemptView } from "@/lib/ai-auth-flow";
import { ApiError } from "@/server/http";
import type { AiAuthScope } from "./attempt-store";

export const DevicePayloadSchema = z.object({
  kind: z.literal("device"),
  deviceCode: z.string().min(1).max(4096),
  userCode: z.string().min(1).max(128),
  verificationUrl: z.string().url().max(4096),
  intervalSeconds: z.number().positive().max(3600),
  enterpriseDomain: z.string().optional(),
}).strict();
export const PkcePayloadSchema = z.object({
  kind: z.literal("pkce"),
  verifier: z.string().min(43).max(128),
  verificationUrl: z.string().url().max(8192),
}).strict();

export type AuthAttemptRow = {
  id: string;
  provider: WebAuthProvider;
  scope_key: string;
  browser_hash: string;
  status: AuthAttemptStatus;
  payload: unknown;
  expires_at: Date;
  next_poll_at: Date | null;
};

export async function lockedAuthAttempt(client: PoolClient, id: string): Promise<AuthAttemptRow> {
  const result = await client.query<AuthAttemptRow>("SELECT * FROM ai_auth_attempts WHERE id = $1 FOR UPDATE", [id]);
  const row = result.rows[0];
  if (!row) throw new ApiError("not_found", "로그인 요청이 만료되었거나 취소되었습니다.");
  WebAuthProviderSchema.parse(row.provider);
  AuthAttemptStatusSchema.parse(row.status);
  return row;
}

export function requireAttemptScope(attempt: AuthAttemptRow, scope: AiAuthScope): void {
  if (!scope.browserHash || attempt.scope_key !== scope.key || attempt.browser_hash !== scope.browserHash) {
    throw new ApiError("forbidden", "로그인을 시작한 브라우저에서 다시 시도해 주세요.");
  }
}

export function authAttemptView(attempt: AuthAttemptRow, now: number): AuthAttemptView {
  const base = {
    id: attempt.id, provider: attempt.provider, status: attempt.status, expiresAt: attempt.expires_at.getTime(),
  };
  if (attempt.status !== "pending") return base;
  if (attempt.provider === "openrouter") {
    const payload = PkcePayloadSchema.parse(attempt.payload);
    return { ...base, verificationUrl: payload.verificationUrl, retryAfterMs: 2000 };
  }
  const payload = DevicePayloadSchema.parse(attempt.payload);
  return {
    ...base, verificationUrl: payload.verificationUrl, userCode: payload.userCode,
    retryAfterMs: Math.max(500, (attempt.next_poll_at?.getTime() ?? now) - now),
  };
}
