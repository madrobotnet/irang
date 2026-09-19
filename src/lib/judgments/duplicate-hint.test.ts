import { describe, expect, it } from "vitest";
import { wireDuplicateHintToBoolean } from "./duplicate-hint";

describe("wireDuplicateHintToBoolean", () => {
  it("is false when wire duplicateHint is null or none", () => {
    expect(wireDuplicateHintToBoolean(null)).toBe(false);
    expect(
      wireDuplicateHintToBoolean({
        relatedNoteId: null,
        choice: "none",
        probability: 0.9,
        confidence: 0.8,
      }),
    ).toBe(false);
  });

  it("is true when relatedNoteId is set", () => {
    expect(
      wireDuplicateHintToBoolean({
        relatedNoteId: "note-a",
        choice: "note-a",
        probability: 0.77,
        confidence: 0.77,
      }),
    ).toBe(true);
  });
});
