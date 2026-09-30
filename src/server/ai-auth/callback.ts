import { aiAuthCopy } from "@/server/i18n/ai-auth-copy";
import type { AuthProtocolOptions } from "@/lib/ai-auth";
import { tx } from "@/server/db";
import { ApiError } from "@/server/http";
import { lockedAuthAttempt, PkcePayloadSchema } from "./attempt-data";
import { exchangeOpenRouterAttempt } from "./openrouter-attempt";

export async function finishOpenRouterAuth(
  input: { readonly id: string; readonly code?: string; readonly denied?: boolean; readonly browserHash?: string },
  options: AuthProtocolOptions = {},
): Promise<{ readonly success: boolean; readonly setup: boolean; readonly pending?: boolean }> {
  return tx(async (client) => {
    const attempt = await lockedAuthAttempt(client, input.id);
    if (!input.browserHash || input.browserHash !== attempt.browser_hash || attempt.provider !== "openrouter") {
      throw new ApiError("forbidden", aiAuthCopy.wrongBrowser);
    }
    if (attempt.status !== "pending") throw new ApiError("conflict", aiAuthCopy.alreadyHandled);
    const payload = PkcePayloadSchema.parse(attempt.payload);
    if (payload.code) throw new ApiError("conflict", aiAuthCopy.alreadyHandled);
    const setup = attempt.scope_key.startsWith("setup:");
    if (input.denied || attempt.expires_at.getTime() <= (options.now ?? Date.now)()) {
      await client.query("UPDATE ai_auth_attempts SET status = 'denied', payload = '{}'::jsonb WHERE id = $1", [input.id]);
      return { success: false, setup };
    }
    if (!input.code || input.code.length > 4096) throw new ApiError("validation", aiAuthCopy.callbackNoCode);
    const result = await exchangeOpenRouterAttempt(client, {
      ...attempt, payload: { ...payload, code: input.code },
    }, options);
    return {
      success: result.status === "ready", setup,
      ...(result.status === "pending" ? { pending: true } : {}),
    };
  });
}
