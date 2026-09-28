import { describe, expect, test } from "bun:test";
import type { NoteSummary } from "@/lib/types";
import { dailyForDate, localDateKey, recentWithoutPinned, relativeTime } from "./home-model";

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

describe("relativeTime", () => {
  const now = Date.parse("2026-09-27T12:00:00.000Z");
  test("buckets by elapsed time and clamps future timestamps", () => {
    expect(relativeTime("2026-09-27T12:00:30.000Z", now)).toBe("방금");
    expect(relativeTime("2026-09-27T11:55:00.000Z", now)).toBe("5분 전");
    expect(relativeTime("2026-09-27T09:00:00.000Z", now)).toBe("3시간 전");
    expect(relativeTime("2026-09-26T11:00:00.000Z", now)).toBe("어제");
    expect(relativeTime("2026-09-24T12:00:00.000Z", now)).toBe("3일 전");
    expect(relativeTime("2026-09-13T12:00:00.000Z", now)).toBe("2주 전");
    expect(relativeTime("not a date", now)).toBe("");
  });
});
