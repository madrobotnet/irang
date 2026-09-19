/**
 * TypeSafe Jev / System One judgment surface (Ada epic-wide).
 * Rex wires the SDK sink; this module is the typed boundary only.
 */

export const DEFAULT_JEV_MODEL = "jev-latest";

export const SYSTEMONE_API_URL = "https://api.typesafe.ai/v1/systemone";

export type JudgmentQuestionType = "noul" | "choice" | "score";

export type NoulQuestion = {
  type: "noul";
  instructions: string;
  criteria?: {
    true?: string;
    false?: string;
  };
};

export type ChoiceQuestion = {
  type: "choice";
  instructions: string;
  criteria: Record<string, string>;
};

export type ScoreQuestion = {
  type: "score";
  instructions: string;
  criteria: string[];
};

export type JudgmentQuestion = NoulQuestion | ChoiceQuestion | ScoreQuestion;

/** Program state passed to Jev (string or structured JSON). */
export type SystemOneState = string | Record<string, unknown>;

export type SystemOneRequest = {
  model?: string;
  state: SystemOneState;
  questions: Record<string, JudgmentQuestion>;
};

export type NoulAnswer = {
  noul: number;
};

export type ChoiceAnswer = {
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
};

export type ScoreAnswer = {
  score: number;
  probabilities: number[];
  confidence: number;
};

export type JudgmentAnswer = NoulAnswer | ChoiceAnswer | ScoreAnswer;

export type SystemOneUsage = {
  input_tokens?: number;
  output_tokens?: number;
};

export type SystemOneResponse = {
  model: string;
  answers: Record<string, JudgmentAnswer>;
  usage?: SystemOneUsage;
};
