import { describe, expect, test } from "bun:test";
import { copyParityIssues } from "@/lib/i18n/copy";
import { LOCALES } from "@/lib/i18n/locale";
import type { NoteSummary } from "@/lib/types";
import { HOME_COPY } from "./home-copy";
import { dailyForDate, homeHeadline, localDateKey, recentWithoutPinned, relativeAge, relativeTime, splitCountPhrase } from "./home-model";

function note(id: string, extra: Partial<NoteSummary> = {}): NoteSummary {
  return {
    id,
    title: id,
    excerpt: "",
    tags: [],
    pinned: false,
    archived: false,
    dailyDate: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...extra,
  };
}

describe("localDateKey", () => {
  test("uses local calendar fields, including just before midnight", () => {
    expect(localDateKey(new Date(2026, 8, 27, 23, 59, 59))).toBe("2026-09-27");
    expect(localDateKey(new Date(2026, 0, 3, 0, 0, 0))).toBe("2026-01-03");
  });
});

describe("dailyForDate", () => {
  test("accepts the server daily only when it is the viewer's local date", () => {
    const daily = note("d", { dailyDate: "2026-09-27" });
    expect(dailyForDate({ daily }, "2026-09-27")).toBe(daily);
    expect(dailyForDate({ daily }, "2026-09-28")).toBeNull();
    expect(dailyForDate({ daily: null }, "2026-09-27")).toBeNull();
  });
});

describe("recentWithoutPinned", () => {
  test("drops pinned notes and keeps recency order", () => {
    const recent = [note("a"), note("b", { pinned: true }), note("c")];
    expect(recentWithoutPinned({ recent, pinned: [recent[1]!] }).map((n) => n.id)).toEqual(["a", "c"]);
  });
});

describe("relativeAge", () => {
  const now = Date.parse("2026-09-27T12:00:00.000Z");
  test("buckets by elapsed time and clamps future timestamps", () => {
    expect(relativeAge("2026-09-27T12:00:30.000Z", now)).toEqual({ unit: "now" });
    expect(relativeAge("2026-09-27T11:55:00.000Z", now)).toEqual({ unit: "minute", value: 5 });
    expect(relativeAge("2026-09-27T09:00:00.000Z", now)).toEqual({ unit: "hour", value: 3 });
    expect(relativeAge("2026-09-26T11:00:00.000Z", now)).toEqual({ unit: "day", value: 1 });
    expect(relativeAge("2026-09-24T12:00:00.000Z", now)).toEqual({ unit: "day", value: 3 });
    expect(relativeAge("2026-09-13T12:00:00.000Z", now)).toEqual({ unit: "week", value: 2 });
    expect(relativeAge("2026-07-01T12:00:00.000Z", now)).toEqual({ unit: "date", sameYear: true });
    expect(relativeAge("2025-07-01T12:00:00.000Z", now)).toEqual({ unit: "date", sameYear: false });
    expect(relativeAge("not a date", now)).toBeNull();
  });
});

describe("relativeTime", () => {
  const now = Date.parse("2026-09-27T12:00:00.000Z");
  test("labels each bucket in the requested locale", () => {
    for (const locale of LOCALES) {
      expect(relativeTime("2026-09-27T12:00:30.000Z", now, locale)).toBe(HOME_COPY[locale].time.justNow);
      expect(relativeTime("2026-09-26T11:00:00.000Z", now, locale)).toBe(HOME_COPY[locale].time.yesterday);
      expect(relativeTime("not a date", now, locale)).toBe("");
    }
    for (const iso of ["2026-09-27T11:55:00.000Z", "2026-09-24T12:00:00.000Z", "2026-09-13T12:00:00.000Z", "2026-07-01T12:00:00.000Z"]) {
      expect(relativeTime(iso, now, "en")).not.toBe(relativeTime(iso, now, "ko"));
    }
  });
});

describe("homeHeadline", () => {
  test("returns a locale-neutral key for what needs attention first", () => {
    const stats = { notes: 3, links: 0, tags: 0 };
    expect(homeHeadline({ inboxCount: 2, stats }, true)).toBe("inbox");
    expect(homeHeadline({ inboxCount: 0, stats: { ...stats, notes: 0 } }, false)).toBe("firstNote");
    expect(homeHeadline({ inboxCount: 0, stats }, false)).toBe("startDaily");
    expect(homeHeadline({ inboxCount: 0, stats }, true)).toBe("clear");
  });
});

describe("home copy", () => {
  test("has Korean and English parity", () => {
    expect(copyParityIssues(HOME_COPY)).toEqual([]);
  });

  test("every count phrase places the number exactly once", () => {
    for (const locale of LOCALES) {
      for (const phrase of Object.values(HOME_COPY[locale].counts)) {
        for (const count of [0, 1, 2]) expect(phrase(count, "\u0000").split("\u0000")).toHaveLength(2);
      }
    }
    expect(splitCountPhrase((_count, value) => `a${value}b`, 1)).toEqual(["a", "b"]);
  });
});
