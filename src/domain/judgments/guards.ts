import type { CaptureJudgmentFields } from "./capture-api-wire";
import type { DuplicateHint, TagSuggestion } from "./types";

function isTagSuggestion(value: unknown): value is TagSuggestion {
  if (!value || typeof value !== "object") {
    return false;
  }
  const row = value as TagSuggestion;
  return typeof row.tag === "string" && typeof row.probability === "number";
}

function isDuplicateHint(value: unknown): value is DuplicateHint {
  if (!value || typeof value !== "object") {
    return false;
  }
  const row = value as DuplicateHint;
  return (
    (row.relatedNoteId === null || typeof row.relatedNoteId === "string") &&
    typeof row.choice === "string" &&
    typeof row.probability === "number" &&
    typeof row.confidence === "number"
  );
}

/** Gate: capture 201 bodies must include Jev judgment fields (no LLM re-check). */
export function parseCaptureJudgmentFields(body: unknown): CaptureJudgmentFields | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const record = body as Record<string, unknown>;
  const suggestions = record.suggestions;
  if (!suggestions || typeof suggestions !== "object") {
    return null;
  }
  const tags = (suggestions as { tags?: unknown }).tags;
  if (!Array.isArray(tags) || !tags.every(isTagSuggestion)) {
    return null;
  }
  const duplicateHint = record.duplicateHint;
  if (duplicateHint !== null && !isDuplicateHint(duplicateHint)) {
    return null;
  }
  return {
    suggestions: { tags },
    duplicateHint: duplicateHint as DuplicateHint | null,
  };
}
