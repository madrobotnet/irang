import { OAuthCredentialSchema, type AuthProtocolOptions } from "@/lib/ai-auth";
import { tx } from "@/server/db";
import { ApiError } from "@/server/http";
import { lockedAuthAttempt, PkcePayloadSchema } from "./attempt-data";
import { exchangeOpenRouterCode, OAuthProtocolError } from "./protocol";

export async function finishOpenRouterAuth(
  input: { readonly id: string; readonly code?: string; readonly denied?: boolean; readonly browserHash?: string },
  options: AuthProtocolOptions = {},
): Promise<{ readonly success: boolean; readonly setup: boolean }> {
  return tx(async (client) => {
    const attempt = await lockedAuthAttempt(client, input.id);
    if (!input.browserHash || input.browserHash !== attempt.browser_hash || attempt.provider !== "openrouter") {
      throw new ApiError("forbidden", "로그인을 시작한 브라우저에서 다시 시도해 주세요.");
    }
    if (attempt.status !== "pending") throw new ApiError("conflict", "이미 처리된 로그인 요청입니다.");
    const setup = attempt.scope_key.startsWith("setup:");
    if (input.denied || attempt.expires_at.getTime() <= (options.now ?? Date.now)()) {
      await client.query("UPDATE ai_auth_attempts SET status = 'denied', payload = '{}'::jsonb WHERE id = $1", [input.id]);
      return { success: false, setup };
    }
    if (!input.code || input.code.length > 4096) throw new ApiError("validation", "로그인 확인 코드가 없습니다.");
    const payload = PkcePayloadSchema.parse(attempt.payload);
    try {
      const credential = OAuthCredentialSchema.parse(await exchangeOpenRouterCode(
        { code: input.code, verifier: payload.verifier }, options,
      ));
      await client.query(
        "UPDATE ai_auth_attempts SET status = 'ready', payload = $2::jsonb WHERE id = $1",
        [input.id, JSON.stringify(credential)],
      );
      return { success: true, setup };
    } catch (error) {
      if (!(error instanceof OAuthProtocolError)) throw error;
      await client.query("UPDATE ai_auth_attempts SET status = 'failed', payload = '{}'::jsonb WHERE id = $1", [input.id]);
      return { success: false, setup };
    }
  });
}
