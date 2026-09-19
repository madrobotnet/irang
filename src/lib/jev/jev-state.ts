import type { CaptureJudgmentPayload, DuplicateHintDto } from "./capture-types";

export type JevUiState =
  | "jev_idle"
  | "jev_loading"
  | "jev_ready"
  | "jev_low_confidence"
  | "jev_error"
  | "key_missing";

/** WIRE_P1: surface low confidence when tag/duplicate signals are weak. */
export const JEV_LOW_CONFIDENCE_THRESHOLD = 0.55;

export function maxTagProbability(suggestions: CaptureJudgmentPayload["suggestions"]): number {
  if (!suggestions.tags.length) return 0;
  return Math.max(...suggestions.tags.map((t) => t.probability));
}

export function captureJudgmentConfidence(
  payload: CaptureJudgmentPayload | null | undefined,
): number | null {
  if (!payload) return null;
  const tagMax = maxTagProbability(payload.suggestions);
  const dup = payload.duplicateHint?.confidence ?? 0;
  const value = Math.max(tagMax, dup);
  return value > 0 ? value : null;
}

export function isLowConfidence(payload: CaptureJudgmentPayload | null | undefined): boolean {
  if (!payload) return false;
  const conf = captureJudgmentConfidence(payload);
  if (conf === null) return false;
  return conf < JEV_LOW_CONFIDENCE_THRESHOLD;
}

export function derivePostCaptureJevState(
  payload: CaptureJudgmentPayload | null | undefined,
): JevUiState {
  if (!payload) return "jev_idle";
  const hasTags = payload.suggestions.tags.length > 0;
  const hasDup =
    payload.duplicateHint !== null &&
    (payload.duplicateHint.relatedNoteId !== null ||
      payload.duplicateHint.choice !== "none");
  if (!hasTags && !hasDup) return "jev_idle";
  if (isLowConfidence(payload)) return "jev_low_confidence";
  return "jev_ready";
}

export function shouldShowDuplicateActions(hint: DuplicateHintDto | null | undefined): boolean {
  return Boolean(hint?.relatedNoteId);
}
