import { confidenceFromTags } from "./judgment";
import type {
  InboxFailureReason,
  InboxItem,
  InboxSuggestions,
  JevFailure,
  PromotionDraft,
  Proposal,
} from "./types";

function confidenceOf(suggestions: InboxSuggestions | null): number | null {
  if (!suggestions) return null;
  if (suggestions.classification) return suggestions.classification.confidence;
  return confidenceFromTags(suggestions.tags, null);
}

/**
 * Preview the stored title and body. Suggestions are tags plus classification
 * confidence. A missing suggestion block is manual promote, not an error.
 */
export function draftFromItem(item: InboxItem): PromotionDraft {
  const suggestions = item.suggestions;
  const tags = suggestions?.tags ?? [];
  const confidence = confidenceOf(suggestions);
  const hasProposal = tags.length > 0 || suggestions?.classification != null;

  if (!hasProposal) {
    return {
      ok: false,
      reason: "unavailable",
      title: item.title,
      summary: item.body,
    };
  }

  return {
    ok: true,
    title: item.title,
    summary: item.body,
    tags,
    confidence,
  };
}

export function manualProposal(item: InboxItem, jevError: JevFailure | null): Proposal {
  return {
    itemId: item.id,
    mode: "manual",
    title: item.title,
    summary: item.body,
    tags: [],
    selectedTags: [],
    confidence: null,
    jevError,
  };
}

/** Selected tags start empty. Nothing is written until the user approves promote. */
export function proposalFromDraft(item: InboxItem, draft: PromotionDraft): Proposal {
  if (!draft.ok) {
    return manualProposal(item, draft.reason === "unavailable" ? null : draft.reason);
  }
  return {
    itemId: item.id,
    mode: "suggest",
    title: draft.title,
    summary: draft.summary,
    tags: draft.tags,
    selectedTags: [],
    confidence: draft.confidence,
    jevError: null,
  };
}

type SuggestOutcome =
  | { ok: true; item: InboxItem }
  | { ok: false; reason: InboxFailureReason };

/**
 * A failed suggest refresh must not keep or invent tags, even when the row
 * already has stored suggestions.
 */
export function proposalAfterSuggest(item: InboxItem, result: SuggestOutcome): Proposal | null {
  if (result.ok) {
    return proposalFromDraft(result.item, draftFromItem(result.item));
  }
  if (result.reason === "not_found") return null;
  if (result.reason === "jev_error" || result.reason === "key_missing") {
    return manualProposal(item, result.reason);
  }
  return manualProposal(item, null);
}
