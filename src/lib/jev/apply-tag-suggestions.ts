/**
 * Tag apply after user approval (E2) — Rex/Kai endpoint TBD.
 * UI must not auto-write tags on capture success.
 */
export type ApplyTagSuggestionsInput = {
  tags: string[];
  noteId?: string;
  inboxItemId?: string;
};

export type ApplyTagSuggestionsResult =
  | { ok: true }
  | { ok: false; reason: "no_target" | "network" };

/** Placeholder until POST /api/capture/tags or note patch supports tags. */
export async function applyTagSuggestions(
  input: ApplyTagSuggestionsInput,
): Promise<ApplyTagSuggestionsResult> {
  if (!input.noteId && !input.inboxItemId) {
    return { ok: false, reason: "no_target" };
  }
  if (input.tags.length === 0) {
    return { ok: true };
  }
  // Contract pending — client records intent only (no silent keyword fallback).
  return { ok: true };
}
