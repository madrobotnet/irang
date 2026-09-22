import type { NoteStatus } from "@/domain/notes/constants";

export type SearchFilters = {
  from: string | null;
  to: string | null;
  status: NoteStatus | null;
};

export const OPEN_SEARCH_FILTERS: SearchFilters = {
  from: null,
  to: null,
  status: null,
};

export type SearchSourceDoc = {
  id: string;
  title: string;
  body: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type NoulJudgment = {
  type: "noul";
  noul: number;
};

export type ChoiceJudgment = {
  type: "choice";
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
};

export type ScoreJudgment = {
  type: "score";
  score: number;
  legend: Record<string, string>;
  probabilities: Record<string, number>;
  confidence: number;
};

export type EvidenceJudgedNote = {
  noteId: string;
  title: string;
  answers: NoulJudgment;
  relevance: ScoreJudgment;
  similarity: ScoreJudgment;
};
