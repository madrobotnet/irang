/** Shared date/time display rule (pure, no React). Omitting `timeZone` uses the runtime's zone; no output carries seconds. */
import { INTL_LOCALE, type Locale } from "./locale";

export type DateInput = string | number | Date;
type ZoneOption = { timeZone?: string };

const DAY_MS = 86_400_000;
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(tag: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${tag}|${JSON.stringify(options)}`;
  let format = formatters.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(tag, options);
    formatters.set(key, format);
  }
  return format;
}

function toTime(value: DateInput): number {
  if (value instanceof Date) return value.getTime();
  return typeof value === "number" ? value : Date.parse(value);
}

function dateParts(time: number, timeZone: string | undefined): { year: string; month: string; day: string } {
  const parts = formatter("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(time);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? "";
  return { year: part("year"), month: part("month"), day: part("day") };
}

function koDate(time: number, timeZone: string | undefined): string {
  const { year, month, day } = dateParts(time, timeZone);
  return `${year}-${month}-${day}`;
}

/** Absolute calendar date. ko "2026-09-29"; en "Sep 29, 2026". Invalid input returns "". */
export function formatDate(value: DateInput, locale: Locale, options: ZoneOption = {}): string {
  const time = toTime(value);
  if (Number.isNaN(time)) return "";
  if (locale === "ko") return koDate(time, options.timeZone);
  return formatter(INTL_LOCALE[locale], { timeZone: options.timeZone, year: "numeric", month: "short", day: "numeric" }).format(time);
}

/** Date and time, never seconds. ko "2026-09-29 오후 7:18"; en "Sep 29, 2026, 7:18 PM". Invalid returns "". */
export function formatDateTime(value: DateInput, locale: Locale, options: ZoneOption = {}): string {
  const time = toTime(value);
  if (Number.isNaN(time)) return "";
  const { timeZone } = options;
  if (locale === "ko") {
    const clock = formatter(INTL_LOCALE.ko, { timeZone, hour: "numeric", minute: "2-digit" }).format(time);
    return `${koDate(time, timeZone)} ${clock}`;
  }
  return formatter(INTL_LOCALE[locale], { timeZone, year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(time);
}

/**
 * Friendly heading for a local YYYY-MM-DD key, read as a calendar date (no zone shift).
 * weekday default true: ko "9월 29일 화요일", en "Tuesday, September 29";
 * weekday false: "9월 29일" / "September 29". A malformed key returns "".
 */
export function formatDayHeading(key: string, locale: Locale, options: { weekday?: boolean } = {}): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return "";
  const time = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const weekday = options.weekday ?? true;
  return formatter(INTL_LOCALE[locale], { timeZone: "UTC", month: "long", day: "numeric", ...(weekday ? { weekday: "long" } : {}) }).format(time);
}

/** YYYY-MM-DD of `value` (default now) in `timeZone` (default runtime zone). */
export function localDateKey(value: DateInput = Date.now(), timeZone?: string): string {
  return koDate(toTime(value), timeZone);
}

/** UTC midnight of the calendar date `time` falls on in `timeZone`. */
function calendarDay(time: number, timeZone: string | undefined): number {
  const { year, month, day } = dateParts(time, timeZone);
  return Date.UTC(Number(year), Number(month) - 1, Number(day));
}

/**
 * Calendar days from `value` to `now` in `timeZone`: 0 is the same date, 1 is the day before.
 * Counts dates, not elapsed 24-hour periods, so a 23-hour daylight-saving day is still one day.
 */
export function calendarDaysAgo(value: DateInput, now: number = Date.now(), timeZone?: string): number {
  return Math.round((calendarDay(now, timeZone) - calendarDay(toTime(value), timeZone)) / DAY_MS);
}
