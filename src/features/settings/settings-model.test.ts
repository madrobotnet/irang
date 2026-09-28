import { describe, expect, test } from "bun:test";
import { daysUntil } from "./settings-model";

describe("daysUntil", () => {
  const now = Date.parse("2026-09-27T12:00:00.000Z");
  test("rounds partial days up and clamps expired sessions to zero", () => {
    expect(daysUntil("2026-10-27T12:00:00.000Z", now)).toBe(30);
    expect(daysUntil("2026-09-27T13:00:00.000Z", now)).toBe(1);
    expect(daysUntil("2026-09-26T12:00:00.000Z", now)).toBe(0);
  });
  test("returns null when the server has no expiry to report", () => {
    expect(daysUntil(null, now)).toBeNull();
    expect(daysUntil("nope", now)).toBeNull();
  });
});
