import { AuthCodeInputSchema, type AuthAttemptView } from "@/lib/ai-auth-flow";
import type { AuthProtocolOptions } from "@/lib/ai-auth";
import { tx } from "@/server/db";
import { ApiError } from "@/server/http";
import type { AiAuthScope } from "./attempt-store";
import { authAttemptView, lockedAuthAttempt, PkcePayloadSchema, requireAttemptScope } from "./attempt-data";
import { completeCodeExchange, prepareCodeExchange } from "./code-attempt";

export async function submitAuthCode(
  input: { readonly id: string; readonly code: string }, scope: AiAuthScope, options: AuthProtocolOptions = {},
): Promise<AuthAttemptView> {
  const { code } = AuthCodeInputSchema.parse({ code: input.code });
  const result = await tx(async (client) => {
    const attempt = await lockedAuthAttempt(client, input.id);
    requireAttemptScope(attempt, scope);
    if (attempt.provider !== "google") throw new ApiError("validation", "이 로그인은 인증 코드 입력을 지원하지 않습니다.");
    const now = (options.now ?? Date.now)();
    if (attempt.expires_at.getTime() <= now) {
      await client.query("UPDATE ai_auth_attempts SET status = 'expired', payload = '{}'::jsonb WHERE id = $1", [attempt.id]);
      return authAttemptView({ ...attempt, status: "expired", payload: {} }, now);
    }
    // A late duplicate submit must not overwrite an already-ready credential.
    if (attempt.status !== "pending") return authAttemptView(attempt, now);
    const payload = PkcePayloadSchema.parse(attempt.payload);
    if (payload.code) throw new ApiError("conflict", "이미 제출한 코드의 인증 결과를 기다려 주세요.");
    return prepareCodeExchange(client, { ...attempt, payload: { ...payload, code } }, options);
  });
  return "attempt" in result ? completeCodeExchange(result, options) : result;
}
