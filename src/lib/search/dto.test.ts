import { describe, expect, it } from "vitest";
import {
  E4_EVIDENCE_PATH,
  E4_GATED_PATHS,
  E4_PROTECTED_API_ROUTES,
  E4_SEARCH_COLLECTION_PATH,
} from "@/lib/auth/e4-gate-paths";
import {
  SEARCH_TYPESAFE_ERROR_CODES,
  searchErrorBody,
  type EvidenceNotesOk,
  type EvidenceNotesResponse,
  type EvidenceQueryDto,
  type JudgmentConfidenceDto,
  type NoulJudgmentDto,
  type ScoreJudgmentDto,
  type SearchQueryDto,
  type SearchResponse,
  type SearchResultsOk,
} from "./dto";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

type TypesafeCode = (typeof SEARCH_TYPESAFE_ERROR_CODES)[number];

type ForbiddenSearchKeys = "fallback" | "keywordFallback" | "keywordScore" | "mode";

type AssertNoForbidden<T> = Extract<keyof T, ForbiddenSearchKeys> extends never ? true : never;

type NoulKeys = keyof NoulJudgmentDto;
type AssertNoulHasNoConfidence = "confidence" extends NoulKeys ? never : true;

const typesafeCodesMatch: Equal<TypesafeCode, "typesafe_misconfigured" | "judgment_failed"> = true;

const noForbiddenOnResults: AssertNoForbidden<SearchResultsOk> = true;
const noForbiddenOnEvidence: AssertNoForbidden<EvidenceNotesOk> = true;
const noForbiddenOnSearchQuery: AssertNoForbidden<SearchQueryDto> = true;
const noForbiddenOnEvidenceQuery: AssertNoForbidden<EvidenceQueryDto> = true;
const noulHasNoConfidence: AssertNoulHasNoConfidence = true;

const ranking: Extract<JudgmentConfidenceDto, { type: "choice" }> = {
  type: "choice",
  choice: "note-1",
  probabilities: { "note-1": 0.91, "note-2": 0.09 },
  confidence: 0.82,
};

const answersQuery: NoulJudgmentDto = { type: "noul", noul: 0.93 };

function resultsEnvelope(): SearchResultsOk {
  return {
    ok: true,
    query: "who owns uploaded notes?",
    answersQuery,
    ranking,
    results: [
      { noteId: "note-1", title: "Ownership", snippet: "You own your notes." },
      { noteId: "note-2", title: "License", snippet: null },
    ],
  };
}

const similarity: ScoreJudgmentDto = {
  type: "score",
  score: 2.4,
  legend: {
    "0": "Unrelated meaning",
    "1": "Same broad topic",
    "2": "Closely related meaning",
    "3": "The same meaning",
  },
  probabilities: { "0": 0.05, "1": 0.1, "2": 0.25, "3": 0.6 },
  confidence: 0.66,
};

function evidenceEnvelope(): EvidenceNotesOk {
  const relevance: ScoreJudgmentDto = {
    type: "score",
    score: 2.1,
    legend: { "0": "Unrelated", "1": "Mentions the topic", "2": "States an answer" },
    probabilities: { "0": 0.05, "1": 0.1, "2": 0.85 },
    confidence: 0.78,
  };
  return {
    ok: true,
    query: "which note answers this?",
    notes: [
      {
        noteId: "note-1",
        title: "Ownership",
        answers: { type: "noul", noul: 0.88 },
        relevance,
        similarity,
      },
      {
        noteId: "note-2",
        title: "License",
        answers: { type: "noul", noul: 0.12 },
        relevance: null,
        similarity: {
          ...similarity,
          score: 0.2,
          probabilities: { "0": 0.8, "1": 0.2, "2": 0, "3": 0 },
          confidence: 0.71,
        },
      },
    ],
  };
}

describe("E4 search DTO seat", () => {
  it("keeps Choice confidence distinct from Noul probability", () => {
    expect(typesafeCodesMatch).toBe(true);
    expect(noForbiddenOnResults).toBe(true);
    expect(noForbiddenOnEvidence).toBe(true);
    expect(noForbiddenOnSearchQuery).toBe(true);
    expect(noForbiddenOnEvidenceQuery).toBe(true);
    expect(noulHasNoConfidence).toBe(true);

    const results = resultsEnvelope();
    expect(results.ranking.confidence).toBe(0.82);
    expect(results.ranking.probabilities[results.ranking.choice]).toBe(0.91);
    expect(results.answersQuery).toEqual({ type: "noul", noul: 0.93 });
    expect(results.answersQuery).not.toHaveProperty("confidence");
    expect(results).not.toHaveProperty("fallback");
    expect(results).not.toHaveProperty("mode");
    expect(results).not.toHaveProperty("keywordScore");
  });

  it("carries evidence as Noul plus optional Score confidence", () => {
    const evidence = evidenceEnvelope();
    expect(evidence.notes[0]?.answers).not.toHaveProperty("confidence");
    expect(evidence.notes[0]?.relevance?.type).toBe("score");
    expect(evidence.notes[0]?.relevance?.confidence).toBe(0.78);
    expect(evidence.notes[0]?.similarity.type).toBe("score");
    expect(evidence.notes[0]?.similarity.confidence).toBe(0.66);
    expect(evidence.notes[0]?.similarity).not.toHaveProperty("noul");
    expect(evidence.notes[1]?.relevance).toBeNull();
    expect(evidence.notes[1]?.similarity.type).toBe("score");
    expect(evidence).not.toHaveProperty("keywordFallback");
  });

  it("reports TypeSafe and key failure as explicit error codes", () => {
    const missingKey: SearchResponse = searchErrorBody("typesafe_misconfigured");
    const failed: EvidenceNotesResponse = searchErrorBody("judgment_failed");
    expect(SEARCH_TYPESAFE_ERROR_CODES).toEqual(["typesafe_misconfigured", "judgment_failed"]);
    expect(missingKey).toEqual({ ok: false, code: "typesafe_misconfigured" });
    expect(failed).toEqual({ ok: false, code: "judgment_failed" });
    expect(E4_SEARCH_COLLECTION_PATH).toBe("/api/search");
    expect(E4_EVIDENCE_PATH).toBe("/api/search/evidence");
    expect([...E4_GATED_PATHS]).toEqual([
      "/search",
      ...E4_PROTECTED_API_ROUTES,
    ]);
  });
});
