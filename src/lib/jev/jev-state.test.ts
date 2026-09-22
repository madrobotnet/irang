import { describe, expect, it } from "vitest";
import { derivePostCaptureJevState, isLowConfidence } from "./jev-state";

describe("derivePostCaptureJevState", () => {
  it("returns idle when no suggestions", () => {
    expect(
      derivePostCaptureJevState({
        suggestions: { tags: [] },
        duplicateHint: null,
      }),
    ).toBe("jev_idle");
  });

  it("returns low_confidence for weak tags", () => {
    expect(
      derivePostCaptureJevState({
        suggestions: { tags: [{ tag: "idea", probability: 0.4 }] },
        duplicateHint: null,
      }),
    ).toBe("jev_low_confidence");
  });

  it("returns ready for strong tags", () => {
    expect(
      derivePostCaptureJevState({
        suggestions: { tags: [{ tag: "idea", probability: 0.8 }] },
        duplicateHint: null,
      }),
    ).toBe("jev_ready");
  });
});

describe("isLowConfidence", () => {
  it("uses duplicate confidence", () => {
    expect(
      isLowConfidence({
        suggestions: { tags: [] },
        duplicateHint: {
          relatedNoteId: "n1",
          choice: "n1",
          probability: 0.9,
          confidence: 0.3,
        },
      }),
    ).toBe(true);
  });
});
