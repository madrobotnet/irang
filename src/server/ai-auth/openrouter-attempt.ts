import type { PoolClient } from "pg";
import { OAuthCredentialSchema, type AuthProtocolOptions } from "@/lib/ai-auth";
import type { AuthAttemptView } from "@/lib/ai-auth-flow";
import { authAttemptView, PkcePayloadSchema, type AuthAttemptRow } from "./attempt-data";
import { exchangeOpenRouterCode, OAuthProtocolError } from "./protocol";

export async function exchangeOpenRouterAttempt(
  client: PoolClient,
  attempt: AuthAttemptRow,
  options: AuthProtocolOptions,
): Promise<AuthAttemptView> {
  const payload = PkcePayloadSchema.parse(attempt.payload);
  const now = (options.now ?? Date.now)();
  if (!payload.code) return authAttemptView(attempt, now);
  try {
    const credential = OAuthCredentialSchema.parse(await exchangeOpenRouterCode(
      { code: payload.code, verifier: payload.verifier }, options,
    ));
    await client.query(
      "UPDATE ai_auth_attempts SET status = 'ready', payload = $2::jsonb WHERE id = $1",
      [attempt.id, JSON.stringify(credential)],
    );
    return authAttemptView({ ...attempt, status: "ready", payload: credential }, now);
  } catch (error) {
    if (!(error instanceof OAuthProtocolError)) throw error;
    if (error.retryable) {
      const intervalSeconds = Math.min(3600, (payload.intervalSeconds ?? 0) + 5);
      const updatedPayload = { ...payload, intervalSeconds };
      const nextPollAt = new Date(now + intervalSeconds * 1000);
      await client.query(
        "UPDATE ai_auth_attempts SET payload = $2::jsonb, next_poll_at = $3 WHERE id = $1",
        [attempt.id, JSON.stringify(updatedPayload), nextPollAt],
      );
      return authAttemptView({ ...attempt, payload: updatedPayload, next_poll_at: nextPollAt }, now);
    }
    await client.query("UPDATE ai_auth_attempts SET status = 'failed', payload = '{}'::jsonb WHERE id = $1", [attempt.id]);
    return authAttemptView({ ...attempt, status: "failed", payload: {} }, now);
  }
}
