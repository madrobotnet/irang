import { describe, expect, test } from "bun:test";
import { calendarDaysAgo } from "./relative-day";

const at = (iso: string) => Date.parse(iso);

describe("calendarDaysAgo", () => {
  test("counts calendar dates in the viewer's zone, not elapsed 24-hour periods", () => {
    // One hour apart: 23:30 and 00:30 in Seoul, the same afternoon or morning in UTC and Los Angeles.
    const edited = "2026-09-28T14:30:00.000Z";
    const now = at("2026-09-28T15:30:00.000Z");
    expect(calendarDaysAgo(edited, now, "Asia/Seoul")).toBe(1);
    expect(calendarDaysAgo(edited, now, "UTC")).toBe(0);
    expect(calendarDaysAgo(edited, now, "America/Los_Angeles")).toBe(0);
  });

  test("26 hours across two midnights is two days", () => {
    expect(calendarDaysAgo("2026-09-27T23:00:00.000Z", at("2026-09-29T01:00:00.000Z"), "UTC")).toBe(2);
  });

  test("the 23-hour day at a daylight-saving change still counts as one day", () => {
    // New York springs forward on 8 March 2026: noon to noon is 23 hours.
    expect(calendarDaysAgo("2026-03-07T17:00:00.000Z", at("2026-03-08T16:00:00.000Z"), "America/New_York")).toBe(1);
  });

  test("a timestamp ahead of the local clock is never counted as past", () => {
    expect(calendarDaysAgo("2026-09-29T12:00:00.000Z", at("2026-09-28T12:00:00.000Z"), "UTC")).toBeLessThanOrEqual(0);
  });
});
