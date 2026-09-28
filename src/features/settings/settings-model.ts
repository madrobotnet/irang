/** Whole days until `expiresAt` (rounded up, never negative); null for a missing or invalid timestamp. */
export function daysUntil(expiresAt: string | null, now: number): number | null {
  if (!expiresAt) return null;
  const at = Date.parse(expiresAt);
  if (Number.isNaN(at)) return null;
  return Math.max(0, Math.ceil((at - now) / 86_400_000));
}

/** "2026년 10월 27일 (화) 오후 9:00" in the viewer's zone. */
export function formatExpiry(expiresAt: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(expiresAt));
}

export type SessionInfo = { ok: boolean; expiresAt: string | null };
export type ChatStatus = { available: boolean };
export type RevokeAllResult = { ok: boolean; revoked: number };
