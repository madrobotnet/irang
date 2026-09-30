const DAY_MS = 86_400_000;
const formatters = new Map<string, Intl.DateTimeFormat>();

/** UTC midnight of the calendar date `time` falls on in `timeZone` (the runtime's zone when omitted). */
function calendarDay(time: number, timeZone: string | undefined): number {
  const key = timeZone ?? "";
  let format = formatters.get(key);
  if (!format) {
    // Numeric parts only; the display language comes from the caller's copy catalog.
    format = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "numeric", day: "numeric" });
    formatters.set(key, format);
  }
  const parts = Object.fromEntries(format.formatToParts(time).map((part) => [part.type, part.value]));
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
}

/**
 * Calendar days from `value` to `now` in `timeZone`: 0 is the same date, 1 is the day before.
 * The note list only renders fetched data in the browser, where the default zone is the viewer's,
 * so server markup never contains a server-zone date.
 */
export function calendarDaysAgo(value: string, now: number = Date.now(), timeZone?: string): number {
  return Math.round((calendarDay(now, timeZone) - calendarDay(Date.parse(value), timeZone)) / DAY_MS);
}
