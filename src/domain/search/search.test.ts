import { describe, expect, it } from "vitest";
import { E4_DEV_GATES, E4_DEV_PROCESS_JUDGMENT, RETRIEVAL_WEIGHTS } from "./dev-process-gates";
import { cosineSimilarity, embedText } from "./embed";
import { reciprocalRankFusion } from "./fusion";
import { selectEvidenceNotes } from "./select";
import { buildSnippet } from "./snippet";
import type { EvidenceJudgedNote } from "./types";

function score(
  probabilities: Record<string, number>,
  value: number,
): EvidenceJudgedNote["relevance"] {
  return {
    type: "score",
    score: value,
    confidence: 0.8,
    legend: { "0": "a", "1": "b", "2": "c", "3": "d" },
    probabilities,
  };
}

function judged(noteId: string, noul: number, relevance: Record<string, number>): EvidenceJudgedNote {
  return {
    noteId,
    title: noteId,
    answers: { type: "noul", noul },
    relevance: score(relevance, 1),
    similarity: score({ "0": 1, "1": 0, "2": 0, "3": 0 }, 0),
  };
}

describe("E4 dev-process gates", () => {
  it("consumes recorded choices at or above the confidence floor", () => {
    expect(E4_DEV_PROCESS_JUDGMENT.fusion.choice).toBe("rrf");
    expect(E4_DEV_GATES.fusion).toBe("rrf");
    expect(E4_DEV_GATES.unindexed).toBe("keyword_hit_marked_indexing");
    expect(E4_DEV_GATES.fts).toBe("simple");
    expect(E4_DEV_GATES.snippet).toBe("match_window");
    expect(E4_DEV_GATES.indexShape).toBe("columns_on_entity");
    expect(E4_DEV_GATES.similarity).toBe("score_rubric");
    expect(E4_DEV_GATES.evidenceMin).toBe(0.55);
    expect(E4_DEV_GATES.batchTrigger).toBe("authenticated_post");
    expect(E4_DEV_PROCESS_JUDGMENT.evidence.confidence).toBeLessThan(0.5);
    expect(E4_DEV_GATES.evidenceShape).toBe("noul_plus_relevance_score");
    expect(E4_DEV_PROCESS_JUDGMENT.routeEffect.confidence).toBeLessThan(0.5);
    expect(E4_DEV_GATES.routeEffect).toBe("equal_hybrid");
    expect(RETRIEVAL_WEIGHTS.keyword).toBe(RETRIEVAL_WEIGHTS.semantic);
    expect(E4_DEV_PROCESS_JUDGMENT.corpus.confidence).toBeLessThan(0.5);
    expect(E4_DEV_GATES.corpus).toBe("notes_only");
    expect(E4_DEV_GATES.embedder).toBe("hashed_ngram_pgvector");
  });
});

describe("hybrid fusion and snippets", () => {
  it("keeps a keyword-only row when the embedding is still missing", () => {
    const fused = reciprocalRankFusion(["note-a"], []);
    expect(fused.map((row) => row.id)).toEqual(["note-a"]);
    expect(fused[0]?.semanticRank).toBeNull();
    expect(fused[0]?.keywordRank).toBe(1);
  });

  it("embeds identical text closer than unrelated text", () => {
    const left = embedText("postgres full text tsvector hybrid search");
    const same = embedText("postgres full text tsvector hybrid search");
    const other = embedText("kimchi stew recipe evening");
    expect(cosineSimilarity(left, same)).toBeCloseTo(1);
    expect(cosineSimilarity(left, other)).toBeLessThan(cosineSimilarity(left, same));
  });

  it("windows the snippet around the query token", () => {
    const snippet = buildSnippet("Ownership", "The vault stores notes that you own outright.", "own");
    expect(snippet).toContain("own");
    expect(snippet?.length ?? 0).toBeLessThan(200);
  });
});

describe("evidence selection", () => {
  it("keeps notes that clear the noul or upper-score bar and preserves order", () => {
    const notes = [
      judged("low", 0.2, { "0": 0.8, "1": 0.2, "2": 0, "3": 0 }),
      judged("noul", 0.55, { "0": 0.5, "1": 0.5, "2": 0, "3": 0 }),
      judged("score", 0.1, { "0": 0, "1": 0.2, "2": 0.5, "3": 0.3 }),
    ];
    expect(selectEvidenceNotes(notes).map((note) => note.noteId)).toEqual(["noul", "score"]);
  });
});
