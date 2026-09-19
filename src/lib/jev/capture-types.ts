/** Client DTOs for capture judgment fields (mirrors Rex wire; no domain import). */

export type TagSuggestionDto = {
  tag: string;
  probability: number;
};

export type CaptureSuggestionsDto = {
  tags: TagSuggestionDto[];
};

export type DuplicateHintDto = {
  relatedNoteId: string | null;
  choice: string;
  probability: number;
  confidence: number;
};

export type CaptureJudgmentPayload = {
  suggestions: CaptureSuggestionsDto;
  duplicateHint: DuplicateHintDto | null;
};
