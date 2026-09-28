import type { PoolClient } from "pg";
import { OAuthCredentialSchema, type OAuthCredential, type WebAuthProvider } from "@/lib/ai-auth";
import { ApiError } from "@/server/http";

export type AiAuthScope = {
  readonly key: string;
  readonly browserHash?: string;
};

/** Claim and delete in the caller's transaction, so rollback preserves the login. */
export async function consumeAuthAttempt(
  client: PoolClient,
  claim: { readonly id: string; readonly provider: WebAuthProvider; readonly scope: AiAuthScope },
): Promise<OAuthCredential> {
  if (!claim.scope.browserHash) throw new ApiError("forbidden", "로그인을 시작한 브라우저에서 저장해 주세요.");
  const result = await client.query<{
    provider: string; status: string; scope_key: string; browser_hash: string;
    payload: unknown; valid: boolean;
  }>(
    `SELECT provider, status, scope_key, browser_hash, payload, expires_at > now() AS valid
     FROM ai_auth_attempts WHERE id = $1 FOR UPDATE`,
    [claim.id],
  );
  const attempt = result.rows[0];
  if (!attempt || attempt.provider !== claim.provider || attempt.scope_key !== claim.scope.key
    || attempt.browser_hash !== claim.scope.browserHash) {
    throw new ApiError("forbidden", "이 연결에 사용할 수 없는 로그인 요청입니다.");
  }
  if (!attempt.valid || attempt.status !== "ready") {
    throw new ApiError("conflict", "로그인을 완료하거나 다시 연결한 뒤 저장해 주세요.");
  }
  const credential = OAuthCredentialSchema.parse(attempt.payload);
  if (credential.provider !== claim.provider) throw new ApiError("conflict", "제공자 인증 정보가 일치하지 않습니다.");
  await client.query("DELETE FROM ai_auth_attempts WHERE id = $1", [claim.id]);
  return credential;
}
