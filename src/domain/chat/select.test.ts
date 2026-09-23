import { describe, expect, it } from "vitest";
import { chatContextExceeded } from "@/lib/chat/dto";
import { chatNoteEligible, selectChatNotes, type ChatNoteCandidate } from "./select";

const HIGH = {
  type: "score" as const,
  score: 2.8,
  confidence: 0.8,
  legend: { "0": "no", "1": "weak", "2": "useful", "3": "direct" },
  probabilities: { "0": 0.02, "1": 0.08, "2": 0.2, "3": 0.7 },
};

const LOW = {
  ...HIGH,
  score: 0.2,
  probabilities: { "0": 0.9, "1": 0.1, "2": 0, "3": 0 },
};

function note(
  noteId: string,
  title: string,
  body: string,
  noul: number,
  relevance: ChatNoteCandidate["relevance"] = HIGH,
): ChatNoteCandidate {
  return {
    noteId,
    title,
    body,
    include: { type: "noul", noul },
    relevance,
  };
}

describe("selectChatNotes", () => {
  it("keeps Jev-included notes and drops a keyword lookalike below the bar", () => {
    const selected = selectChatNotes(
      [
        note("keyword", "alpha zebra", "alpha alpha alpha", 0.1, LOW),
        note("judged", "boats", "no shared tokens with the question", 0.91),
      ],
      { maxNotes: 10, maxChars: 32_000 },
    );
    expect(chatNoteEligible(note("keyword", "alpha zebra", "alpha", 0.1, LOW))).toBe(false);
    expect(selected.selected.map((row) => row.noteId)).toEqual(["judged"]);
    expect(chatContextExceeded(selected.contextLimit)).toBe(false);
  });

  it("caps the packed context at 10 notes and 32k characters", () => {
    const many = Array.from({ length: 12 }, (_, index) =>
      note(`n${String(index).padStart(2, "0")}`, `title ${index}`, "x".repeat(100), 0.9, {
        ...HIGH,
        score: 12 - index,
      }),
    );
    const capped = selectChatNotes(many, { maxNotes: 10, maxChars: 32_000 });
    expect(capped.selected).toHaveLength(10);
    expect(capped.selected[0]?.noteId).toBe("n00");
    expect(capped.contextLimit.noteCount).toBe(10);
    expect(capped.contextLimit.tokenCount).toBeLessThanOrEqual(32_000);
    expect(chatContextExceeded(capped.contextLimit)).toBe(false);

    const huge = selectChatNotes(
      [note("big", "T", "y".repeat(50_000), 0.99), note("next", "N", "z".repeat(100), 0.99)],
      { maxNotes: 10, maxChars: 32_000 },
    );
    expect(huge.selected).toHaveLength(1);
    expect(huge.selected[0]?.excerpt.length).toBeLessThan(32_000);
    expect(huge.contextLimit.tokenCount).toBeLessThanOrEqual(32_000);
    expect(chatContextExceeded(huge.contextLimit)).toBe(false);
  });
});
