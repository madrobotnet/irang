import type { SearchIndexStatus } from "@/domain/search/index-status";

export type { SearchIndexStatus } from "@/domain/search/index-status";

/** Choice or Score answer. Noul is not part of this envelope. */
export type JudgmentConfidenceDto =
  | {
      type: "choice";
      /** Highest-probability option. */
      choice: string;
      /** Option → probability. Floats that sum to 1. */
      probabilities: Record<string, number>;
      /** 0–1, derived from `probabilities`. */
      confidence: number;
    }
  | {
      type: "score";
      /** Probability-weighted position. May fall between levels. */
      score: number;
      /** Level index (string) → description. */
      legend: Record<string, string>;
      /** Level index → probability. Floats that sum to 1. */
      probabilities: Record<string, number>;
      /** 0–1, derived from `probabilities`. */
      confidence: number;
    };

/** Noul answer. Probability of yes. No separate confidence. */
export type NoulJudgmentDto = {
  type: "noul";
  /** 0–1. Near 0.5 is yes/no uncertainty, not medium intensity. */
  noul: number;
};

export type SearchHitDto = {
  noteId: string;
  title: string;
  snippet: string | null;
};

/**
 * Search-result envelope.
 * `ranking` is one Choice over candidate note ids plus `none`.
 * `answersQuery` is a separate Noul: Choice always picks a winner, so a
 * peaked rank does not mean the vault answers the question.
 * Both answers are stored as Jev returned them.
 */
export type SearchResultsOk = {
  ok: true;
  indexStatus: SearchIndexStatus;
  query: string;
  answersQuery: NoulJudgmentDto;
  ranking: Extract<JudgmentConfidenceDto, { type: "choice" }>;
  results: SearchHitDto[];
};

/** Score answer. Confidence is distribution concentration, not a second judgment. */
export type ScoreJudgmentDto = Extract<JudgmentConfidenceDto, { type: "score" }>;

/**
 * One note judged as evidence for a question.
 * `answers` is a Noul (several notes may apply).
 * `relevance` is a Score of how well the note answers the question.
 * Null means that question was not asked.
 * `similarity` is the Score Rex returns for meaning overlap with the query.
 * Scores are stored as Jev returned them. Nothing re-verifies them.
 */
export type EvidenceNoteDto = {
  noteId: string;
  title: string;
  answers: NoulJudgmentDto;
  relevance: ScoreJudgmentDto | null;
  similarity: ScoreJudgmentDto;
};

export type EvidenceNotesOk = {
  ok: true;
  indexStatus: SearchIndexStatus;
  query: string;
  notes: EvidenceNoteDto[];
};

export type SearchKeyErrorCode = "typesafe_misconfigured";

export type SearchJudgmentErrorCode = "judgment_failed";

export type SearchTypesafeErrorCode = SearchKeyErrorCode | SearchJudgmentErrorCode;

export const SEARCH_TYPESAFE_ERROR_CODES = [
  "typesafe_misconfigured",
  "judgment_failed",
] as const satisfies readonly SearchTypesafeErrorCode[];

export type SearchErrorCode =
  | SearchTypesafeErrorCode
  | "validation"
  | "unauthorized";

export type SearchErrorBody = {
  ok: false;
  code: SearchErrorCode;
};

export type SearchResponse = SearchResultsOk | SearchErrorBody;

export type EvidenceNotesResponse = EvidenceNotesOk | SearchErrorBody;

export type SearchQueryDto = {
  query: string;
};

/**
 * `POST /api/search/evidence` body.
 * Candidates are retrieved in code. Jev judges them; this list is not a rank.
 */
export type EvidenceQueryDto = {
  query: string;
  candidateNoteIds: string[];
};

export function searchErrorBody(code: SearchErrorCode): SearchErrorBody {
  return { ok: false, code };
}
