import type { TagSuggestion } from "@/domain/judgments/types";
import {
  type InboxClassId,
  type InboxClassification,
  INBOX_CLASS_VOCABULARY,
  isInboxClassId,
} from "./classification";

/** Stored Jev output. Presence here is not an applied tag. */
export type StoredInboxSuggestions = {
  tags: TagSuggestion[];
  classification: InboxClassification | null;
  judgedAt: string;
};

function isTagSuggestion(value: unknown): value is TagSuggestion {
  if (!value || typeof value !== "object") {
    return false;
  }
  const row = value as TagSuggestion;
  return typeof row.tag === "string" && typeof row.probability === "number";
}

function parseClassification(value: unknown): InboxClassification | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Partial<InboxClassification> & {
    probabilities?: Record<string, unknown>;
  };
  if (typeof row.choice !== "string" || !isInboxClassId(row.choice)) {
    return null;
  }
  if (typeof row.probability !== "number" || typeof row.confidence !== "number") {
    return null;
  }
  if (!row.probabilities || typeof row.probabilities !== "object") {
    return null;
  }
  const probabilities = {} as Record<InboxClassId, number>;
  for (const entry of INBOX_CLASS_VOCABULARY) {
    const probability = row.probabilities[entry.id];
    if (typeof probability !== "number") {
      return null;
    }
    probabilities[entry.id] = probability;
  }
  return {
    choice: row.choice,
    probability: row.probability,
    confidence: row.confidence,
    probabilities,
  };
}

export function parseStoredInboxSuggestions(value: unknown): StoredInboxSuggestions | null {
  let record: unknown = value;
  if (typeof value === "string") {
    try {
      record = JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }
  if (!record || typeof record !== "object") {
    return null;
  }
  const row = record as {
    tags?: unknown;
    classification?: unknown;
    judgedAt?: unknown;
  };
  if (!Array.isArray(row.tags) || !row.tags.every(isTagSuggestion)) {
    return null;
  }
  if (typeof row.judgedAt !== "string" || row.judgedAt.length === 0) {
    return null;
  }
  if (row.classification == null) {
    return { tags: row.tags, classification: null, judgedAt: row.judgedAt };
  }
  const classification = parseClassification(row.classification);
  if (!classification) {
    return null;
  }
  return { tags: row.tags, classification, judgedAt: row.judgedAt };
}

export function storedSuggestionsFromJudgment(
  suggestions: { tags: TagSuggestion[]; classification?: InboxClassification | null },
  judgedAt: string,
): StoredInboxSuggestions {
  return {
    tags: suggestions.tags,
    classification: suggestions.classification ?? null,
    judgedAt,
  };
}
