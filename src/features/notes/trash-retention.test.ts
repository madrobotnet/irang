import { describe, expect, test } from "bun:test";
import { daysUntilPurge } from "./trash-retention";

const now = Date.parse("2026-09-30T14:00:00.000Z"); // 2026-09-30 23:00 in Seoul

describe("daysUntilPurge", () => {
  test("counts calendar days in the given time zone, not 24-hour periods", () => {
    // 2026-10-03 00:30 in Seoul, but still 2026-10-02 in UTC.
    expect(daysUntilPurge("2026-10-02T15:30:00.000Z", now, "Asia/Seoul")).toBe(3);
    expect(daysUntilPurge("2026-10-02T15:30:00.000Z", now, "UTC")).toBe(2);
  });

  test("a purge later today is 0, and so is an overdue one", () => {
    expect(daysUntilPurge("2026-09-30T14:59:00.000Z", now, "Asia/Seoul")).toBe(0);
    expect(daysUntilPurge("2026-09-28T00:00:00.000Z", now, "Asia/Seoul")).toBe(0);
  });

  test("tomorrow is 1 and the full retention period is 30", () => {
    expect(daysUntilPurge("2026-09-30T15:00:00.000Z", now, "Asia/Seoul")).toBe(1);
    expect(daysUntilPurge(new Date(now + 30 * 86_400_000).toISOString(), now, "Asia/Seoul")).toBe(30);
  });

  test("a missing or malformed purge date is unknown", () => {
    expect(daysUntilPurge(null, now)).toBeNull();
    expect(daysUntilPurge("not a date", now)).toBeNull();
  });
});
