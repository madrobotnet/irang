import { JEV_LOW_CONFIDENCE_THRESHOLD } from "@/lib/jev/jev-state";
import type { TagSuggestion } from "./types";

export { JEV_LOW_CONFIDENCE_THRESHOLD };
export const JEV_HIGH_CONFIDENCE_THRESHOLD = 0.75;

export function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function confidenceFromTags(
  tags: readonly TagSuggestion[],
  explicit: number | null,
): number | null {
  if (explicit !== null && Number.isFinite(explicit)) {
    return clamp01(explicit);
  }
  if (tags.length === 0) return null;
  return clamp01(Math.max(...tags.map((tag) => tag.probability)));
}

export function isLowConfidence(confidence: number | null): boolean {
  return confidence !== null && confidence < JEV_LOW_CONFIDENCE_THRESHOLD;
}

export function confidenceBand(confidence: number): "불확실" | "중" | "고" {
  if (confidence < JEV_LOW_CONFIDENCE_THRESHOLD) return "불확실";
  if (confidence < JEV_HIGH_CONFIDENCE_THRESHOLD) return "중";
  return "고";
}
