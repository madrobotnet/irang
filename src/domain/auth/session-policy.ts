import { MAX_CONCURRENT_SESSIONS, SESSION_TTL_MS } from "./constants";
import type { SessionRecord } from "./types";

export function sessionExpiry(now: number, ttlMs: number = SESSION_TTL_MS): number {
  return now + ttlMs;
}

export function isSessionActive(session: SessionRecord, now: number): boolean {
  if (session.revokedAt !== null && session.revokedAt <= now) {
    return false;
  }
  return session.expiresAt > now;
}

/** Active sessions only; drop oldest by createdAt when over cap. */
export function publicIdsToDropOldest(
  sessions: readonly SessionRecord[],
  now: number,
  max: number = MAX_CONCURRENT_SESSIONS,
): string[] {
  const active = sessions.filter((s) => isSessionActive(s, now));
  if (active.length <= max) {
    return [];
  }
  const oldestFirst = [...active].sort((a, b) => {
    if (a.createdAt !== b.createdAt) {
      return a.createdAt - b.createdAt;
    }
    return a.publicId.localeCompare(b.publicId);
  });
  const dropCount = active.length - max;
  return oldestFirst.slice(0, dropCount).map((s) => s.publicId);
}
