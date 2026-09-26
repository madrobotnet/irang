import { describe, expect, it } from "vitest";
import type { EvidenceNotesOk, SearchResultsOk } from "./dto";
import { interpretEvidenceBody, interpretSearchBody, searchCollectionUrl } from "./parse";

const ranked: SearchResultsOk = {
  ok: true,
  indexStatus: "ready",
  query: "who owns uploaded notes?",
  answersQuery: { type: "noul", noul: 0.93 },
  ranking: {
    type: "choice",
    choice: "note-1",
    probabilities: { "note-1": 0.91, "note-2": 0.09 },
    confidence: 0.82,
  },
  results: [
    { noteId: "note-1", title: "Ownership", snippet: "You own your notes." },
    { noteId: "note-2", title: "License", snippet: null },
  ],
};

const similarity = {
  type: "score" as const,
  score: 2.4,
  legend: { "2": "비슷한 의미" },
  probabilities: { "2": 0.6 },
  confidence: 0.66,
};

const evidence: EvidenceNotesOk = {
  ok: true,
  indexStatus: "ready",
  query: "which note answers this?",
  notes: [
    {
      noteId: "note-1",
      title: "Ownership",
      answers: { type: "noul", noul: 0.88 },
      relevance: {
        type: "score",
        score: 2.1,
        legend: { "0": "Unrelated", "2": "States an answer" },
        probabilities: { "0": 0.05, "2": 0.85 },
        confidence: 0.78,
      },
      similarity,
    },
  ],
};

describe("interpretSearchBody", () => {
  it("keeps a ranked envelope as returned", () => {
    expect(interpretSearchBody(200, ranked)).toEqual({ ok: true, envelope: ranked });
  });

  it("drops hits when TypeSafe reports judgment_failed", () => {
    expect(
      interpretSearchBody(502, {
        ok: false,
        code: "judgment_failed",
        results: ranked.results,
      }),
    ).toEqual({ ok: false, reason: "jev_error" });
  });

  it("drops hits when the key is missing", () => {
    expect(
      interpretSearchBody(503, {
        ok: false,
        code: "typesafe_misconfigured",
        results: ranked.results,
      }),
    ).toEqual({ ok: false, reason: "key_missing" });
  });

  it("rejects a keyword fallback even when rows are attached", () => {
    expect(
      interpretSearchBody(200, {
        ...ranked,
        fallback: "keyword",
      }),
    ).toEqual({ ok: false, reason: "jev_error" });
    expect(
      interpretSearchBody(200, {
        ok: true,
        mode: "indexing",
        results: ranked.results,
      }),
    ).toEqual({ ok: false, reason: "jev_error" });
    expect(
      interpretSearchBody(200, {
        ok: true,
        indexStatus: "ready",
        query: ranked.query,
        answersQuery: ranked.answersQuery,
        ranking: ranked.ranking,
        results: [{ ...ranked.results[0], keywordScore: 12 }],
      }),
    ).toEqual({ ok: false, reason: "jev_error" });
  });

  it("maps 502 and 503 contract codes onto error banners, not hits", () => {
    expect(interpretSearchBody(502, { ok: false, results: ranked.results })).toEqual({
      ok: false,
      reason: "jev_error",
    });
    expect(interpretSearchBody(200, { ok: false, code: "jev_error", results: ranked.results })).toEqual({
      ok: false,
      reason: "jev_error",
    });
    expect(interpretSearchBody(503, { ok: false })).toEqual({ ok: false, reason: "key_missing" });
    expect(interpretSearchBody(200, { ok: false, code: "key_missing", results: ranked.results })).toEqual({
      ok: false,
      reason: "key_missing",
    });
    expect(
      interpretSearchBody(503, {
        ok: false,
        code: "search_index_unavailable",
        results: ranked.results,
      }),
    ).toEqual({ ok: false, reason: "indexing" });
  });

  it("rejects a Noul that smuggles confidence", () => {
    expect(
      interpretSearchBody(200, {
        ...ranked,
        answersQuery: { type: "noul", noul: 0.93, confidence: 0.93 },
      }),
    ).toEqual({ ok: false, reason: "error" });
  });

  it("keeps indexStatus and does not turn a Jev failure into that field", () => {
    expect(interpretSearchBody(200, { ...ranked, indexStatus: "indexing" })).toEqual({
      ok: true,
      envelope: { ...ranked, indexStatus: "indexing" },
    });
    expect(interpretSearchBody(200, { ...ranked, indexStatus: "keyword_only" })).toEqual({
      ok: true,
      envelope: { ...ranked, indexStatus: "keyword_only" },
    });
    expect(
      interpretSearchBody(502, {
        ok: false,
        code: "judgment_failed",
        indexStatus: "indexing",
        results: ranked.results,
      }),
    ).toEqual({ ok: false, reason: "jev_error" });
  });

  it("treats a missing indexStatus as ready", () => {
    const { indexStatus: _indexStatus, ...withoutStatus } = ranked;
    expect(interpretSearchBody(200, withoutStatus)).toEqual({
      ok: true,
      envelope: { ...ranked, indexStatus: "ready" },
    });
  });

  it("rejects an unknown indexStatus", () => {
    expect(interpretSearchBody(200, { ...ranked, indexStatus: "pending" })).toEqual({
      ok: false,
      reason: "error",
    });
  });

  it("treats an empty judged result list as success with no rows", () => {
    const empty: SearchResultsOk = {
      ...ranked,
      results: [],
    };
    expect(interpretSearchBody(200, empty)).toEqual({ ok: true, envelope: empty });
  });
});

describe("interpretEvidenceBody", () => {
  it("keeps Noul answers, relevance, and the similarity Score", () => {
    expect(interpretEvidenceBody(200, evidence)).toEqual({ ok: true, envelope: evidence });
  });

  it("rejects evidence that omits similarity", () => {
    const { similarity: _similarity, ...note } = evidence.notes[0]!;
    expect(
      interpretEvidenceBody(200, {
        ...evidence,
        notes: [note],
      }),
    ).toEqual({ ok: false, reason: "error" });
  });

  it("does not keep notes when judgment fails", () => {
    expect(
      interpretEvidenceBody(200, {
        ok: false,
        code: "judgment_failed",
        notes: evidence.notes,
      }),
    ).toEqual({ ok: false, reason: "jev_error" });
  });

  it("treats a missing indexStatus as ready", () => {
    const { indexStatus: _indexStatus, ...withoutStatus } = evidence;
    expect(interpretEvidenceBody(200, withoutStatus)).toEqual({
      ok: true,
      envelope: { ...evidence, indexStatus: "ready" },
    });
  });
});

describe("searchCollectionUrl", () => {
  it("sends the query seat and no filter or fallback switch", () => {
    expect(searchCollectionUrl("노트 검색")).toBe("/api/search?query=%EB%85%B8%ED%8A%B8+%EA%B2%80%EC%83%89");
    expect(searchCollectionUrl("노트 검색")).not.toContain("fallback");
    expect(searchCollectionUrl("노트 검색")).not.toContain("type=");
    expect(
      searchCollectionUrl("소유", { status: "draft", from: "2026-01-01", to: "2026-09-22" }),
    ).toBe("/api/search?query=%EC%86%8C%EC%9C%A0&status=draft&from=2026-01-01&to=2026-09-22");
  });
});
