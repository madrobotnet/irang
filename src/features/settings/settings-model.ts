import { formatDateTime } from "@/lib/i18n/format-date";
import type { Locale } from "@/lib/i18n/locale";

/** Whole days until `expiresAt` (rounded up, never negative); null for a missing or invalid timestamp. */
export function daysUntil(expiresAt: string | null, now: number): number | null {
  if (!expiresAt) return null;
  const at = Date.parse(expiresAt);
  if (Number.isNaN(at)) return null;
  return Math.max(0, Math.ceil((at - now) / 86_400_000));
}

/** "2026-10-27 오후 9:00" / "Oct 27, 2026, 9:00 PM" in the viewer's zone. */
export function formatExpiry(expiresAt: string, locale: Locale): string {
  return formatDateTime(expiresAt, locale);
}

export type SessionInfo = { ok: boolean; expiresAt: string | null };
export type ChatStatus = { available: boolean };
export type RevokeAllResult = { ok: boolean; revoked: number };
