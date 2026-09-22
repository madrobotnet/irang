import { describe, expect, it } from "vitest";
import { INBOX_CLASS_VOCABULARY } from "./classification";
import { parseStoredInboxSuggestions } from "./suggestions";

function probabilities(choice: string, probability: number): Record<string, number> {
  const rest = (1 - probability) / (INBOX_CLASS_VOCABULARY.length - 1);
  return Object.fromEntries(
    INBOX_CLASS_VOCABULARY.map((entry) => [entry.id, entry.id === choice ? probability : rest]),
  );
}

describe("parseStoredInboxSuggestions", () => {
  it("accepts a complete stored judgment", () => {
    const parsed = parseStoredInboxSuggestions({
      tags: [{ tag: "idea", probability: 0.8 }],
      classification: {
        choice: "idea",
        probability: 0.8,
        confidence: 0.7,
        probabilities: probabilities("idea", 0.8),
      },
      judgedAt: "2026-09-22T00:00:00.000Z",
    });
    expect(parsed?.classification?.choice).toBe("idea");
    expect(parsed?.tags).toEqual([{ tag: "idea", probability: 0.8 }]);
  });

  it("rejects incomplete classification instead of filling probabilities", () => {
    expect(
      parseStoredInboxSuggestions({
        tags: [],
        classification: {
          choice: "idea",
          probability: 0.8,
          confidence: 0.7,
          probabilities: { idea: 0.8 },
        },
        judgedAt: "2026-09-22T00:00:00.000Z",
      }),
    ).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(parseStoredInboxSuggestions(null)).toBeNull();
  });
});
