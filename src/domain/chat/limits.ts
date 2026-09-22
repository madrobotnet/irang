import { CHAT_CONTEXT_MAX_NOTES, CHAT_CONTEXT_MAX_TOKENS } from "@/lib/chat/dto";

/**
 * Budget for one chat turn.
 * `maxChars` is the 32k character cap. It is also reported through Kai's
 * `tokenCount` field, whose hard cap is 32_000, so the two budgets match.
 * Env may lower a cap. It cannot raise it past the Kai constants.
 */
export function chatContextBudget(env: NodeJS.ProcessEnv = process.env): {
  maxNotes: number;
  maxChars: number;
} {
  const notes = Number(env.CHAT_MAX_NOTES);
  const chars = Number(env.CHAT_MAX_CONTEXT_TOKENS);
  const maxNotes =
    Number.isFinite(notes) && notes >= 1
      ? Math.min(Math.floor(notes), CHAT_CONTEXT_MAX_NOTES)
      : CHAT_CONTEXT_MAX_NOTES;
  const maxChars =
    Number.isFinite(chars) && chars >= 1
      ? Math.min(Math.floor(chars), CHAT_CONTEXT_MAX_TOKENS)
      : CHAT_CONTEXT_MAX_TOKENS;
  return { maxNotes, maxChars };
}

export function aiLogTtlDays(env: NodeJS.ProcessEnv = process.env): number {
  const days = Number(env.AI_LOG_TTL_DAYS);
  if (!Number.isFinite(days) || days < 1) {
    return 7;
  }
  return Math.floor(days);
}

export function aiLogExpiry(now: Date, ttlDays = aiLogTtlDays()): Date {
  return new Date(now.getTime() - ttlDays * 24 * 60 * 60 * 1000);
}
