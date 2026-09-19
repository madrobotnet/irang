import { afterEach, describe, expect, it, vi } from "vitest";
import { daysUntilTrashPurge, resetNotesApiPreference } from "./client-api";

describe("daysUntilTrashPurge", () => {
  afterEach(() => {
    vi.useRealTimers();
    resetNotesApiPreference();
  });

  it("returns full retention when just trashed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-19T12:00:00Z"));
    const trashedAt = "2026-09-19T12:00:00Z";
    expect(daysUntilTrashPurge(trashedAt, 7)).toBe(7);
  });

  it("counts down toward zero", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-24T12:00:00Z"));
    const trashedAt = "2026-09-19T12:00:00Z";
    expect(daysUntilTrashPurge(trashedAt, 7)).toBe(2);
  });
});
