import type { PoolClient } from "pg";
import type { AuthProtocolOptions, OAuthCredential } from "@/lib/ai-auth";
import type { AuthAttemptView } from "@/lib/ai-auth-flow";
import { tx } from "@/server/db";
import { authAttemptView, DevicePayloadSchema, lockedAuthAttempt, PkcePayloadSchema, type AuthAttemptRow } from "./attempt-data";
import { exchangeGoogleCode } from "./google";
import { OAuthProtocolError } from "./http";
import { exchangeOpenAiCode, pollOpenAiDeviceAuthorization } from "./openai";

type CodePayload = ReturnType<typeof DevicePayloadSchema.parse> | ReturnType<typeof PkcePayloadSchema.parse>;
export type CodeExchangeClaim = { readonly attempt: AuthAttemptRow; readonly payload: CodePayload };

async function saveState(client: PoolClient, attempt: AuthAttemptRow, now: number): Promise<AuthAttemptView> {
  await client.query(
    "UPDATE ai_auth_attempts SET status = $2, payload = $3::jsonb, next_poll_at = $4 WHERE id = $1",
    [attempt.id, attempt.status, JSON.stringify(attempt.payload), attempt.next_poll_at],
  );
  return authAttemptView(attempt, now);
}

function retry(attempt: AuthAttemptRow, payload: CodePayload, now: number): AuthAttemptRow {
  const intervalSeconds = Math.min(3600, (payload.intervalSeconds ?? 0) + 5);
  return { ...attempt, payload: { ...payload, intervalSeconds, exchangeState: "prepared" },
    next_poll_at: new Date(now + intervalSeconds * 1000) };
}

/** Commit a one-time exchange claim BEFORE sending the token POST. A crashed or
 * disconnected worker cannot cause another process to replay an ambiguous POST. */
export async function prepareCodeExchange(
  client: PoolClient, attempt: AuthAttemptRow, options: AuthProtocolOptions,
): Promise<AuthAttemptView | CodeExchangeClaim> {
  const now = (options.now ?? Date.now)();
  let payload: CodePayload = attempt.provider === "google"
    ? PkcePayloadSchema.parse(attempt.payload) : DevicePayloadSchema.parse(attempt.payload);
  if (payload.exchangeState === "in_flight") return authAttemptView(attempt, now);
  if (payload.kind === "pkce" && !payload.code) return authAttemptView(attempt, now);
  if (payload.kind === "device" && !payload.openaiCode) {
    try {
      const result = await pollOpenAiDeviceAuthorization(payload, options);
      switch (result.status) {
        case "pending":
          return saveState(client, { ...attempt, next_poll_at: new Date(now + payload.intervalSeconds * 1000) }, now);
        case "denied":
          return saveState(client, { ...attempt, status: "denied", payload: {} }, now);
        case "code":
          payload = { ...payload, openaiCode: result.code };
          break;
        default: {
          const exhaustive: never = result;
          return exhaustive;
        }
      }
    } catch (error) {
      if (!(error instanceof OAuthProtocolError)) throw error;
      return saveState(client, error.retryable ? retry(attempt, payload, now)
        : { ...attempt, status: "failed", payload: {} }, now);
    }
  }
  const claimed = { ...payload, exchangeState: "in_flight" as const };
  await saveState(client, { ...attempt, payload: claimed }, now);
  return { attempt, payload: claimed };
}

export async function completeCodeExchange(claim: CodeExchangeClaim, options: AuthProtocolOptions): Promise<AuthAttemptView> {
  const { attempt, payload } = claim;
  let credential: OAuthCredential | undefined;
  let failure: OAuthProtocolError | undefined;
  try {
    switch (payload.kind) {
      case "device":
        if (!payload.openaiCode) throw new TypeError("Missing claimed OpenAI code");
        credential = await exchangeOpenAiCode(payload.openaiCode, options);
        break;
      case "pkce":
        if (!payload.code) throw new TypeError("Missing claimed Google code");
        credential = await exchangeGoogleCode({ code: payload.code, verifier: payload.verifier }, options);
        break;
      default: {
        const exhaustive: never = payload;
        return exhaustive;
      }
    }
  } catch (error) {
    if (error instanceof OAuthProtocolError) failure = error;
    else if (options.signal?.aborted) failure = new OAuthProtocolError(attempt.provider, "exchange cancelled");
    else throw error;
  }
  return tx(async (client) => {
    // Cancellation deletes the row. Never recreate it from this stale claim.
    const current = await lockedAuthAttempt(client, attempt.id);
    const now = (options.now ?? Date.now)();
    if (current.expires_at.getTime() <= now) {
      return saveState(client, { ...current, status: "expired", payload: {} }, now);
    }
    if (current.status !== "pending") return authAttemptView(current, now);
    if (credential) return saveState(client, { ...current, status: "ready", payload: credential }, now);
    // Only explicit rate-limit/server responses are retryable. Network errors,
    // timeouts and interrupted success bodies may already have consumed the code.
    if (failure?.status !== undefined && (failure.status === 429 || failure.status >= 500)) {
      return saveState(client, retry(current, payload, now), now);
    }
    const status = failure?.code === "access_denied" || failure?.code === "authorization_declined" ? "denied" : "failed";
    return saveState(client, { ...current, status, payload: {} }, now);
  });
}
