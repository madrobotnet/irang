import type { InboxClassification } from "@/domain/inbox/classification";

/** Typed Jev / TypeSafe judgment results for API responses (UI consumes later). */

export type JudgmentNoul = {
  kind: "noul";
  /** Probability of yes (0–1). */
  probability: number;
};

export type JudgmentChoice = {
  kind: "choice";
  choice: string;
  /** Probability of the selected label (0–1). */
  probability: number;
  /** Model-reported confidence in the selected label (0–1). */
  confidence: number;
  probabilities: Record<string, number>;
};

export type TagSuggestion = {
  tag: string;
  /** Noul probability that this tag applies (proposal only). */
  probability: number;
};

export type DuplicateHint = {
  /** Existing note that may duplicate the capture, or null when none / uncertain. */
  relatedNoteId: string | null;
  choice: string;
  probability: number;
  confidence: number;
};

export type CaptureSuggestions = {
  tags: TagSuggestion[];
  /** Present when the inbox classification question was asked. Not an applied tag. */
  classification?: InboxClassification;
};

export type CaptureJudgments = {
  suggestions: CaptureSuggestions;
  duplicateHint: DuplicateHint | null;
};
