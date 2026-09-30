/**
 * Calendar arithmetic on local `YYYY-MM-DD` day keys. A key is already a local calendar date, so
 * the math runs on UTC midnights and no time zone or daylight-saving shift can move a day.
 */

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_KEY = /^(\d{4})-(\d{2})$/;
const DAY_MS = 86_400_000;
/** The calendar API accepts years 1000-9999. */
const MIN_YEAR = 1000;
const MAX_YEAR = 9999;

export type DailyTarget = { kind: "today" } | { kind: "date"; date: string } | { kind: "invalid" };

const pad = (value: number, length = 2) => String(value).padStart(length, "0");

function keyFromUtc(time: number): string | null {
  const date = new Date(time);
  const year = date.getUTCFullYear();
  if (year < MIN_YEAR || year > MAX_YEAR) return null;
  return `${pad(year, 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function utcOf(key: string): number | null {
  const match = DAY_KEY.exec(key);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const time = Date.UTC(year, month - 1, day);
  return keyFromUtc(time) === key ? time : null;
}

export function isDayKey(value: unknown): value is string {
  return typeof value === "string" && utcOf(value) !== null;
}

/** `?date=` of `/daily`: absent opens today, a valid day key opens that day, anything else is invalid. */
export function readDailyDateParam(raw: string | string[] | undefined): DailyTarget {
  if (raw === undefined) return { kind: "today" };
  return typeof raw === "string" && isDayKey(raw) ? { kind: "date", date: raw } : { kind: "invalid" };
}

/** Null when the input is invalid or the result leaves years 1000-9999. */
export function addDays(key: string, days: number): string | null {
  const time = utcOf(key);
  return time === null ? null : keyFromUtc(time + days * DAY_MS);
}

/** Shift by whole months, clamping the day to the target month's length (Jan 31 + 1 = Feb 28/29). */
export function addMonths(key: string, months: number): string | null {
  const time = utcOf(key);
  if (time === null) return null;
  const date = new Date(time);
  const first = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1);
  const target = new Date(first);
  const length = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return keyFromUtc(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(date.getUTCDate(), length)));
}

export function monthOf(key: string): string {
  return key.slice(0, 7);
}

export function monthParts(month: string): { year: number; month: number } | null {
  const match = MONTH_KEY.exec(month);
  if (!match || !isDayKey(`${month}-01`)) return null;
  return { year: Number(match[1]), month: Number(match[2]) };
}

/** 0 = Sunday. */
export function weekdayOf(key: string): number {
  const time = utcOf(key);
  return time === null ? 0 : new Date(time).getUTCDay();
}

/** Six Sunday-first weeks (a stable height) padded with neighboring days; days outside years 1000-9999 are null. */
export function monthGrid(month: string): (string | null)[][] {
  const first = utcOf(`${month}-01`);
  if (first === null) return [];
  const start = first - new Date(first).getUTCDay() * DAY_MS;
  return Array.from({ length: 6 }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => keyFromUtc(start + (week * 7 + day) * DAY_MS)));
}

/**
 * Grid focus movement for a key press, following the WAI-ARIA date picker pattern: arrows move by
 * a day or a week, Home/End to the week's start/end, PageUp/PageDown by a month (with Shift, a year).
 * Returns null for keys the grid does not handle or moves past the supported years.
 */
export function calendarMove(key: string, press: { key: string; shiftKey?: boolean }): string | null {
  const months = press.shiftKey ? 12 : 1;
  switch (press.key) {
    case "ArrowLeft": return addDays(key, -1);
    case "ArrowRight": return addDays(key, 1);
    case "ArrowUp": return addDays(key, -7);
    case "ArrowDown": return addDays(key, 7);
    case "Home": return addDays(key, -weekdayOf(key));
    case "End": return addDays(key, 6 - weekdayOf(key));
    case "PageUp": return addMonths(key, -months);
    case "PageDown": return addMonths(key, months);
    default: return null;
  }
}

/** An existing daily note opens directly; any other day goes through the get-or-create launcher. */
export function dailyHref(date: string, noteId: string | undefined): string {
  return noteId ? `/notes/${noteId}` : `/daily?date=${date}`;
}
