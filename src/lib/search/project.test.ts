import { describe, expect, it } from "vitest";
import type { EvidenceNotesOk, SearchResultsOk } from "./dto";
import { projectRows } from "./project";

const envelope: SearchResultsOk = {
  ok: true,
  indexStatus: "ready",
  query: "소유",
  answersQuery: { type: "noul", noul: 0.93 },
  ranking: {
    type: "choice",
    choice: "note-1",
    probabilities: { "note-1": 0.91, "note-2": 0.09 },
    confidence: 0.82,
  },
  results: [
    { noteId: "note-1", title: "소유권", snippet: "내 노트" },
    { noteId: "note-2", title: "라이선스", snippet: null },
  ],
};

const evidence: EvidenceNotesOk = {
  ok: true,
  indexStatus: "ready",
  query: "소유",
  notes: [
    {
      noteId: "note-1",
      title: "소유권",
      answers: { type: "noul", noul: 0.4 },
      relevance: {
        type: "score",
        score: 1.2,
        legend: { "1": "Mentions" },
        probabilities: { "1": 0.4 },
        confidence: 0.33,
      },
      similarity: {
        type: "score",
        score: 2.4,
        legend: { "2": "비슷한 의미" },
        probabilities: { "2": 0.6 },
        confidence: 0.66,
      },
    },
  ],
};

describe("projectRows", () => {
  it("uses the stored choice probability and a notes path", () => {
    const rows = projectRows(envelope, null);
    expect(rows[0]).toMatchObject({
      noteId: "note-1",
      title: "소유권",
      path: "notes/note-1",
      snippet: "내 노트",
      probability: 0.91,
      relevance: null,
    });
    expect(rows[1]?.probability).toBe(0.09);
    expect(rows[1]?.snippet).toBeNull();
  });

  it("reads Score confidence for evidence and ignores Noul as confidence", () => {
    const rows = projectRows(envelope, evidence);
    expect(rows[0]?.relevance).toBe(0.33);
    expect(rows[0]?.similarity).toBe(0.66);
    expect(rows[0]?.similarityLabel).toBe("비슷한 의미");
    expect(rows[0]).not.toHaveProperty("noul");
    expect(rows[1]?.relevance).toBeNull();
    expect(rows[1]?.similarity).toBeNull();
  });
});
