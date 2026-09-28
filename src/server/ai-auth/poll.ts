import { OAuthCredentialSchema, type AuthProtocolOptions } from "@/lib/ai-auth";
import type { AuthAttemptView } from "@/lib/ai-auth-flow";
import { tx } from "@/server/db";
import type { AiAuthScope } from "./attempt-store";
import { authAttemptView, DevicePayloadSchema, lockedAuthAttempt, requireAttemptScope } from "./attempt-data";
import { OAuthProtocolError, pollDeviceAuthorization } from "./protocol";

export async function pollAuthAttempt(
  id: string,
  scope: AiAuthScope,
  options: AuthProtocolOptions = {},
): Promise<AuthAttemptView> {
  return tx(async (client) => {
    const attempt = await lockedAuthAttempt(client, id);
    requireAttemptScope(attempt, scope);
    const now = (options.now ?? Date.now)();
    if (attempt.expires_at.getTime() <= now) {
      await client.query("UPDATE ai_auth_attempts SET status = 'expired', payload = '{}'::jsonb WHERE id = $1", [id]);
      return { id, provider: attempt.provider, status: "expired", expiresAt: attempt.expires_at.getTime() };
    }
    if (attempt.status !== "pending" || attempt.provider === "openrouter"
      || (attempt.next_poll_at?.getTime() ?? 0) > now) {
      return authAttemptView(attempt, now);
    }
    const payload = DevicePayloadSchema.parse(attempt.payload);
    try {
      const result = await pollDeviceAuthorization(attempt.provider, payload.deviceCode, {
        ...options, enterpriseDomain: payload.enterpriseDomain,
      });
      switch (result.status) {
        case "complete": {
          const credential = OAuthCredentialSchema.parse(result.credential);
          await client.query("UPDATE ai_auth_attempts SET status = 'ready', payload = $2::jsonb WHERE id = $1", [id, JSON.stringify(credential)]);
          return { id, provider: attempt.provider, status: "ready", expiresAt: attempt.expires_at.getTime() };
        }
        case "denied":
        case "expired":
          await client.query("UPDATE ai_auth_attempts SET status = $2, payload = '{}'::jsonb WHERE id = $1", [id, result.status]);
          return { id, provider: attempt.provider, status: result.status, expiresAt: attempt.expires_at.getTime() };
        case "pending":
        case "slow_down": {
          const interval = result.status === "slow_down"
            ? Math.max(payload.intervalSeconds + 5, result.intervalSeconds ?? 0)
            : Math.max(payload.intervalSeconds, result.intervalSeconds ?? 0);
          const nextPollAt = new Date(now + interval * 1000);
          const updatedPayload = { ...payload, intervalSeconds: interval };
          await client.query(
            "UPDATE ai_auth_attempts SET payload = $2::jsonb, next_poll_at = $3 WHERE id = $1",
            [id, JSON.stringify(updatedPayload), nextPollAt],
          );
          return authAttemptView({ ...attempt, payload: updatedPayload, next_poll_at: nextPollAt }, now);
        }
        default: {
          const exhaustive: never = result;
          return exhaustive;
        }
      }
    } catch (error) {
      if (!(error instanceof OAuthProtocolError)) throw error;
      await client.query("UPDATE ai_auth_attempts SET status = 'failed', payload = '{}'::jsonb WHERE id = $1", [id]);
      return { id, provider: attempt.provider, status: "failed", expiresAt: attempt.expires_at.getTime() };
    }
  });
}

export async function cancelAuthAttempt(id: string, scope: AiAuthScope): Promise<void> {
  await tx(async (client) => {
    const attempt = await lockedAuthAttempt(client, id);
    requireAttemptScope(attempt, scope);
    await client.query("DELETE FROM ai_auth_attempts WHERE id = $1", [id]);
  });
}
