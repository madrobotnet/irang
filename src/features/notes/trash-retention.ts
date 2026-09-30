import { calendarDaysAgo } from "@/lib/i18n/format-date";

/**
 * Calendar days in `timeZone` (default: the runtime zone) from `now` until `purgeAt`.
 * 0 means the purge falls today or is already overdue; null when the note has no purge date.
 */
export function daysUntilPurge(purgeAt: string | null, now: number = Date.now(), timeZone?: string): number | null {
  if (!purgeAt) return null;
  const time = Date.parse(purgeAt);
  if (Number.isNaN(time)) return null;
  return Math.max(0, calendarDaysAgo(now, time, timeZone));
}
