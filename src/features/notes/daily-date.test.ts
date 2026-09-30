import { afterEach, describe, expect, test } from "bun:test";
import {
  addDays, addMonths, calendarMove, dailyHref, isDayKey, monthGrid, monthOf, monthParts, readDailyDateParam, weekdayOf,
} from "./daily-date";

const originalZone = process.env.TZ;
afterEach(() => {
  // Assigning undefined stores the string "undefined" and keeps the last zone for later test files.
  if (originalZone === undefined) delete process.env.TZ;
  else process.env.TZ = originalZone;
});

describe("day keys", () => {
  test("accepts real calendar dates in years 1000-9999 only", () => {
    expect(["2026-09-30", "2024-02-29", "1000-01-01", "9999-12-31"].filter(isDayKey)).toHaveLength(4);
    expect(["2026-02-29", "2026-13-01", "2026-9-30", "0999-12-31", "2026-09-30T00:00", "", " 2026-09-30"].some(isDayKey)).toBe(false);
    expect(isDayKey(20260930)).toBe(false);
  });

  test("reads the /daily date parameter", () => {
    expect(readDailyDateParam(undefined)).toEqual({ kind: "today" });
    expect(readDailyDateParam("2026-09-28")).toEqual({ kind: "date", date: "2026-09-28" });
    expect(readDailyDateParam("2026-02-30")).toEqual({ kind: "invalid" });
    expect(readDailyDateParam("")).toEqual({ kind: "invalid" });
    expect(readDailyDateParam(["2026-09-28", "2026-09-29"])).toEqual({ kind: "invalid" });
  });

  test("month and weekday parts", () => {
    expect(monthOf("2026-09-30")).toBe("2026-09");
    expect(monthParts("2026-09")).toEqual({ year: 2026, month: 9 });
    expect(monthParts("2026-13")).toBeNull();
    expect(weekdayOf("2026-09-27")).toBe(0);
    expect(weekdayOf("2026-09-30")).toBe(3);
  });
});

describe("date arithmetic", () => {
  test("crosses month, year and leap-day boundaries", () => {
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-09-30", -7)).toBe("2026-09-23");
  });

  test("stops at the supported years and rejects invalid input", () => {
    expect(addDays("9999-12-31", 1)).toBeNull();
    expect(addDays("1000-01-01", -1)).toBeNull();
    expect(addDays("2026-02-30", 1)).toBeNull();
    expect(addMonths("9999-12-01", 1)).toBeNull();
  });

  test("counts calendar days across daylight-saving changes in any runtime zone", () => {
    for (const zone of ["America/New_York", "Europe/Berlin", "Australia/Lord_Howe", "Asia/Seoul"]) {
      process.env.TZ = zone;
      expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
      expect(addDays("2026-03-29", 1)).toBe("2026-03-30");
      expect(addDays("2026-04-05", -1)).toBe("2026-04-04");
      expect(addDays("2026-11-01", 1)).toBe("2026-11-02");
      expect(weekdayOf("2026-03-08")).toBe(0);
    }
  });

  test("month steps clamp the day to the target month", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
    expect(addMonths("2026-09-30", 12)).toBe("2027-09-30");
    expect(addMonths("2024-02-29", -12)).toBe("2023-02-28");
  });
});

describe("month grid", () => {
  test("six Sunday-first weeks padded with neighboring days", () => {
    const grid = monthGrid("2026-09");
    expect(grid).toHaveLength(6);
    expect(grid.every((week) => week.length === 7)).toBe(true);
    expect(grid[0]).toEqual(["2026-08-30", "2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05"]);
    expect(grid[5]![6]).toBe("2026-10-10");
    const days = grid.flat();
    expect(days.filter((key) => key?.startsWith("2026-09"))).toHaveLength(30);
    expect(days.every((key, index) => index === 0 || key === addDays(days[index - 1]!, 1))).toBe(true);
  });

  test("a month starting on Sunday opens with its first day", () => {
    expect(monthGrid("2026-02")[0]![0]).toBe("2026-02-01");
  });

  test("days outside the supported years are empty", () => {
    const first = monthGrid("1000-01").flat();
    const firstDay = first.indexOf("1000-01-01");
    expect(first.slice(0, firstDay).every((key) => key === null)).toBe(true);
    expect(monthGrid("1000-13")).toEqual([]);
  });
});

describe("calendar keyboard movement", () => {
  const from = "2026-09-30"; // a Wednesday
  test.each([
    ["ArrowLeft", false, "2026-09-29"],
    ["ArrowRight", false, "2026-10-01"],
    ["ArrowUp", false, "2026-09-23"],
    ["ArrowDown", false, "2026-10-07"],
    ["Home", false, "2026-09-27"],
    ["End", false, "2026-10-03"],
    ["PageUp", false, "2026-08-30"],
    ["PageDown", false, "2026-10-30"],
    ["PageUp", true, "2025-09-30"],
    ["PageDown", true, "2027-09-30"],
  ] as const)("%s (shift %p) moves to %s", (key, shiftKey, expected) => {
    expect(calendarMove(from, { key, shiftKey })).toBe(expected);
  });

  test("PageDown from a month end clamps and other keys are not handled", () => {
    expect(calendarMove("2026-01-31", { key: "PageDown" })).toBe("2026-02-28");
    for (const key of ["Enter", " ", "Escape", "Tab", "a"]) expect(calendarMove(from, { key })).toBeNull();
  });
});

test("an existing note opens directly and any other day goes through the launcher", () => {
  expect(dailyHref("2026-09-28", "0b7c3f1e-0000-4000-8000-000000000001")).toBe("/notes/0b7c3f1e-0000-4000-8000-000000000001");
  expect(dailyHref("2026-09-28", undefined)).toBe("/daily?date=2026-09-28");
});
