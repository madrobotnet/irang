/**
 * Dev-process Jev gates for E4 (recorded System One, jev-1.13.0).
 * Code reads these choices directly. Do not re-ask a model to reinterpret them.
 * Confidence below 0.5 is not acted on (TypeSafe confidence guidance).
 */

export type GateChoice<TChoice extends string> = {
  choice: TChoice;
  confidence: number;
  probabilities: Record<string, number>;
};

export const E4_DEV_PROCESS_JUDGMENT: {
  fusion: GateChoice<"rrf" | "weighted_sum" | "union_then_jev">;
  unindexed: GateChoice<"keyword_hit_marked_indexing" | "omit_until_embedded">;
  evidence: GateChoice<"noul_threshold_set" | "single_choice" | "score_cutoff">;
  evidenceMin: GateChoice<"p45" | "p55" | "p70">;
  similarity: GateChoice<"score_rubric" | "noul_same_meaning">;
  corpus: GateChoice<"notes_and_open_inbox" | "notes_only">;
  fts: GateChoice<"simple" | "english">;
  embedder: GateChoice<"hashed_ngram_pgvector" | "block_without_external_embedder">;
  snippet: GateChoice<"match_window" | "title_only">;
  batchTrigger: GateChoice<"authenticated_post" | "process_interval">;
  indexShape: GateChoice<"sidecar_table" | "columns_on_entity">;
  routeEffect: GateChoice<"changes_blend" | "label_only">;
} = {
  fusion: {
    choice: "rrf",
    confidence: 0.54,
    probabilities: { weighted_sum: 0.13, rrf: 0.69, union_then_jev: 0.18 },
  },
  unindexed: {
    choice: "keyword_hit_marked_indexing",
    confidence: 1,
    probabilities: { omit_until_embedded: 0, keyword_hit_marked_indexing: 1 },
  },
  evidence: {
    choice: "score_cutoff",
    confidence: 0.24,
    probabilities: { noul_threshold_set: 0.43, single_choice: 0.08, score_cutoff: 0.49 },
  },
  evidenceMin: {
    choice: "p55",
    confidence: 0.54,
    probabilities: { p55: 0.69, p45: 0.02, p70: 0.29 },
  },
  similarity: {
    choice: "score_rubric",
    confidence: 0.96,
    probabilities: { score_rubric: 0.98, noul_same_meaning: 0.02 },
  },
  corpus: {
    choice: "notes_only",
    confidence: 0.03,
    probabilities: { notes_only: 0.51, notes_and_open_inbox: 0.49 },
  },
  fts: {
    choice: "simple",
    confidence: 0.99,
    probabilities: { simple: 0.99, english: 0.01 },
  },
  embedder: {
    choice: "hashed_ngram_pgvector",
    confidence: 0.27,
    probabilities: { block_without_external_embedder: 0.36, hashed_ngram_pgvector: 0.64 },
  },
  snippet: {
    choice: "match_window",
    confidence: 0.98,
    probabilities: { match_window: 0.99, title_only: 0.01 },
  },
  batchTrigger: {
    choice: "authenticated_post",
    confidence: 1,
    probabilities: { authenticated_post: 1, process_interval: 0 },
  },
  indexShape: {
    choice: "columns_on_entity",
    confidence: 0.9,
    probabilities: { sidecar_table: 0.05, columns_on_entity: 0.95 },
  },
  routeEffect: {
    choice: "changes_blend",
    confidence: 0.3,
    probabilities: { changes_blend: 0.65, label_only: 0.35 },
  },
};

const CONFIDENCE_FLOOR = 0.5;

/** Keep `expected`. A confident judgment that names a different choice fails closed. */
function lockedGate<T extends string>(
  judgment: { choice: string; confidence: number },
  expected: T,
): T {
  if (judgment.confidence >= CONFIDENCE_FLOOR && judgment.choice !== expected) {
    throw new Error(`dev gate ${expected} drifted from judgment ${judgment.choice}`);
  }
  return expected;
}

function evidenceMinProbability(): number {
  const judgment = E4_DEV_PROCESS_JUDGMENT.evidenceMin;
  const choice = judgment.confidence >= CONFIDENCE_FLOOR ? judgment.choice : "p55";
  if (choice === "p45") {
    return 0.45;
  }
  if (choice === "p70") {
    return 0.7;
  }
  return 0.55;
}

export const E4_DEV_GATES: {
  fusion: "rrf";
  unindexed: "keyword_hit_marked_indexing";
  /** score_cutoff was below the confidence floor. The search envelope is Noul + Score. */
  evidenceShape: "noul_plus_relevance_score";
  evidenceMin: number;
  similarity: "score_rubric";
  /** Result rows are note ids. Low-confidence corpus choice is not used to add inbox rows. */
  corpus: "notes_only";
  fts: "simple";
  /** Embedder choice was below the floor. pgvector still needs a vector with no second API. */
  embedder: "hashed_ngram_pgvector";
  snippet: "match_window";
  /** Protected search POST/GET runs the batch. No in-process timer. */
  batchTrigger: "authenticated_post";
  indexShape: "columns_on_entity";
  /** changes_blend was below the floor, so keyword and semantic weights stay equal. */
  routeEffect: "equal_hybrid";
} = {
  fusion: lockedGate(E4_DEV_PROCESS_JUDGMENT.fusion, "rrf"),
  unindexed: lockedGate(E4_DEV_PROCESS_JUDGMENT.unindexed, "keyword_hit_marked_indexing"),
  evidenceShape: lockedGate(E4_DEV_PROCESS_JUDGMENT.evidence, "noul_plus_relevance_score"),
  evidenceMin: evidenceMinProbability(),
  similarity: lockedGate(E4_DEV_PROCESS_JUDGMENT.similarity, "score_rubric"),
  corpus: lockedGate(E4_DEV_PROCESS_JUDGMENT.corpus, "notes_only"),
  fts: lockedGate(E4_DEV_PROCESS_JUDGMENT.fts, "simple"),
  embedder: lockedGate(E4_DEV_PROCESS_JUDGMENT.embedder, "hashed_ngram_pgvector"),
  snippet: lockedGate(E4_DEV_PROCESS_JUDGMENT.snippet, "match_window"),
  batchTrigger: lockedGate(E4_DEV_PROCESS_JUDGMENT.batchTrigger, "authenticated_post"),
  indexShape: lockedGate(E4_DEV_PROCESS_JUDGMENT.indexShape, "columns_on_entity"),
  routeEffect: lockedGate(E4_DEV_PROCESS_JUDGMENT.routeEffect, "equal_hybrid"),
};

export const RETRIEVAL_WEIGHTS = { keyword: 1, semantic: 1 } as const;

export const SEARCH_SHORTLIST = 8;
export const EVIDENCE_CAP = 10;
export const OVERNIGHT_INDEX_LIMIT = 100;
