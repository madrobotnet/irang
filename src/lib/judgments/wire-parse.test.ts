import { describe, expect, it } from "vitest";
import { parseCaptureJudgmentFields } from "./index";

describe("parseCaptureJudgmentFields (Kai re-export)", () => {
  it("accepts Rex capture 201 judgment wire", () => {
    const parsed = parseCaptureJudgmentFields({
      ok: true,
      target: "note",
      note: { id: "n1" },
      suggestions: { tags: [{ tag: "idea", probability: 0.7 }] },
      duplicateHint: {
        relatedNoteId: "n0",
        choice: "n0",
        probability: 0.6,
        confidence: 0.5,
      },
    });
    expect(parsed?.duplicateHint?.relatedNoteId).toBe("n0");
  });

  it("rejects malformed duplicateHint objects", () => {
    expect(
      parseCaptureJudgmentFields({
        suggestions: { tags: [] },
        duplicateHint: { choice: "x" },
      }),
    ).toBeNull();
  });
});
