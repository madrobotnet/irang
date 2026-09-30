import { INTL_LOCALE, type Locale } from "@/lib/i18n/locale";
import type { HomeData, NoteSummary } from "@/lib/types";
import { HOME_COPY } from "./home-copy";

/** Local calendar date as YYYY-MM-DD (the browser's zone, not UTC). */
export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * A cached dashboard can cross midnight. Only trust its daily note when it
 * matches the viewer's current local date.
 */
export function dailyForDate(home: Pick<HomeData, "daily">, today: string): NoteSummary | null {
  return home.daily && home.daily.dailyDate === today ? home.daily : null;
}

/** Pinned notes also appear in the pinned column; keep the recent list for everything else. */
export function recentWithoutPinned(home: Pick<HomeData, "recent" | "pinned">): NoteSummary[] {
  const pinned = new Set(home.pinned.map((note) => note.id));
  return home.recent.filter((note) => !pinned.has(note.id));
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Elapsed-time bucket, locale-neutral so the label can follow a language switch. */
export type RelativeAge =
  | { unit: "now" }
  | { unit: "minute" | "hour" | "day" | "week"; value: number }
  | { unit: "date"; sameYear: boolean };

/** Buckets a timestamp against an explicit `now` (keeps render pure and testable); future times clamp to now. */
export function relativeAge(iso: string, now: number): RelativeAge | null {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  const diff = Math.max(0, now - then);
  if (diff < MINUTE) return { unit: "now" };
  if (diff < HOUR) return { unit: "minute", value: Math.floor(diff / MINUTE) };
  if (diff < DAY) return { unit: "hour", value: Math.floor(diff / HOUR) };
  const days = Math.floor(diff / DAY);
  if (days < 7) return { unit: "day", value: days };
  if (days < 30) return { unit: "week", value: Math.floor(days / 7) };
  return { unit: "date", sameYear: new Date(then).getFullYear() === new Date(now).getFullYear() };
}

/** Short relative time in `locale`; older dates use the viewer's local calendar. */
export function relativeTime(iso: string, now: number, locale: Locale): string {
  const age = relativeAge(iso, now);
  if (!age) return "";
  const { time } = HOME_COPY[locale];
  if (age.unit === "now") return time.justNow;
  if (age.unit === "date") {
    const options: Intl.DateTimeFormatOptions = age.sameYear ? { month: "long", day: "numeric" } : { year: "numeric", month: "long", day: "numeric" };
    return new Intl.DateTimeFormat(INTL_LOCALE[locale], options).format(new Date(iso));
  }
  if (age.unit === "day" && age.value === 1) return time.yesterday;
  return new Intl.RelativeTimeFormat(INTL_LOCALE[locale], { numeric: "always" }).format(-age.value, age.unit);
}

/** Placeholder for the styled number inside a translated count phrase. */
const COUNT_SLOT = "\u0000";

/** Text before and after the number in a count phrase ("노트 {n}개", "{n} notes"). */
export function splitCountPhrase(phrase: (count: number, value: string) => string, count: number): [string, string] {
  const [before = "", after = ""] = phrase(count, COUNT_SLOT).split(COUNT_SLOT);
  return [before, after];
}

export type HomeHeadline = "inbox" | "firstNote" | "startDaily" | "clear";

/** Which headline tops home, chosen from what actually needs attention. */
export function homeHeadline(home: Pick<HomeData, "inboxCount" | "stats">, hasDaily: boolean): HomeHeadline {
  if (home.inboxCount > 0) return "inbox";
  if (home.stats.notes === 0) return "firstNote";
  if (!hasDaily) return "startDaily";
  return "clear";
}
