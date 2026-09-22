/**
 * Kai judgment type boundary — re-export Rex domain wire/types for client code.
 * UI must import from here (or `note-dto`), not `@/domain/**`.
 */

export type {
  CaptureJudgments,
  CaptureSuggestions,
  DuplicateHint,
  JudgmentChoice,
  JudgmentNoul,
  TagSuggestion,
} from "@/domain/judgments";

export type {
  CaptureInboxCreatedResponse,
  CaptureJudgmentFields,
  CaptureNoteCreatedResponse,
  CaptureShareCreatedResponse,
} from "@/domain/judgments/capture-api-wire";

export { parseCaptureJudgmentFields } from "@/domain/judgments/guards";
export { wireDuplicateHintToBoolean } from "./duplicate-hint";
