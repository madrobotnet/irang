import { describe, expect, test } from "bun:test";
import { daysUntil, formatExpiry } from "./settings-model";

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

describe("formatExpiry", () => {
  test("formats the same instant in each locale's own date style", () => {
    const at = "2026-10-27T12:00:00.000Z";
    const ko = formatExpiry(at, "ko");
    const en = formatExpiry(at, "en");
    expect(ko).toContain("2026");
    expect(en).toContain("2026");
    expect(en).not.toBe(ko);
    expect(en).not.toMatch(/[\uac00-\ud7af]/);
  });
});
