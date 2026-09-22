/**
 * E4 search envelopes (DTO seat only).
 *
 * Shapes follow TypeSafe Judgment answers:
 * - Choice: `choice`, `probabilities`, `confidence`
 * - Score: `score`, `legend`, `probabilities`, `confidence`
 * - Noul: `noul` (probability of yes). No confidence field.
 *
 * Confidence summarizes how peaked a Choice or Score distribution is.
 * It is not a Noul probability and not permission to act.
 *
 * Store Jev output as returned. Do not add a second model pass that
 * re-verifies the judgment.
 *
 * TypeSafe or key failure is `SearchErrorBody`. There is no keyword-search
 * success variant and no silent fallback field.
 */

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
  /** Optional snippet. Not a keyword score. */
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

/** Evidence-note envelope. */
export type EvidenceNotesOk = {
  ok: true;
  query: string;
  notes: EvidenceNoteDto[];
};

/**
 * Key missing, blank, or not injected for this environment.
 * Callers show the error. They do not run keyword search instead.
 */
export type SearchKeyErrorCode = "typesafe_misconfigured";

/**
 * System One call failed.
 * Callers show the error. They do not run keyword search instead.
 */
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

/** `GET /api/search` query seat. No fallback switch. */
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
