export {
  E4_DEV_GATES,
  E4_DEV_PROCESS_JUDGMENT,
  EVIDENCE_CAP,
  OVERNIGHT_INDEX_LIMIT,
  RETRIEVAL_WEIGHTS,
  SEARCH_SHORTLIST,
} from "./dev-process-gates";
export { EMBEDDER_ID, EMBEDDING_DIM, cosineSimilarity, embedText, vectorLiteral } from "./embed";
export { reciprocalRankFusion, RRF_K } from "./fusion";
export { selectEvidenceNotes } from "./select";
export { buildSnippet } from "./snippet";
export { sourceHash, tokenize } from "./text";
export type {
  ChoiceJudgment,
  EvidenceJudgedNote,
  NoulJudgment,
  ScoreJudgment,
  SearchFilters,
  SearchSourceDoc,
} from "./types";
export { OPEN_SEARCH_FILTERS } from "./types";
