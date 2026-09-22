import { describe, expect, it } from "vitest";
import { draftFromItem, proposalAfterSuggest, proposalFromDraft } from "./draft";
import { confidenceBand, isLowConfidence } from "./judgment";
import type { InboxItem, InboxSuggestions } from "./types";

const stored: InboxSuggestions = {
  tags: [
    { tag: "idea", probability: 0.42 },
    { tag: "task", probability: 0.7 },
  ],
  classification: { choice: "idea", probability: 0.5, confidence: 0.44 },
  judgedAt: "2026-09-22T00:00:00.000Z",
};

function row(patch: Partial<InboxItem> = {}): InboxItem {
  return {
    id: "item-1",
    title: "원제목",
    body: "원문",
    source: "web",
    url: null,
    createdAt: "2026-09-22T00:00:00.000Z",
    promotedNoteId: null,
    discardedAt: null,
    suggestions: null,
    ...patch,
  };
}

describe("draftFromItem", () => {
  it("stays manual when Rex did not send a proposal", () => {
    const draft = draftFromItem(row());
    expect(draft).toMatchObject({ ok: false, reason: "unavailable", title: "원제목", summary: "원문" });
  });

  it("keeps the stored title and leaves tags unselected", () => {
    const item = row({ suggestions: stored });
    const draft = draftFromItem(item);
    expect(draft.ok).toBe(true);
    const proposal = proposalFromDraft(item, draft);
    expect(proposal.mode).toBe("suggest");
    expect(proposal.title).toBe("원제목");
    expect(proposal.summary).toBe("원문");
    expect(proposal.selectedTags).toEqual([]);
    expect(proposal.confidence).toBe(0.44);
    expect(isLowConfidence(proposal.confidence)).toBe(true);
    expect(confidenceBand(0.44)).toBe("불확실");
  });

  it("uses the strongest tag when classification is absent", () => {
    const item = row({
      suggestions: {
        tags: stored.tags,
        classification: null,
        judgedAt: stored.judgedAt,
      },
    });
    const proposal = proposalFromDraft(item, draftFromItem(item));
    expect(proposal.confidence).toBe(0.7);
    expect(isLowConfidence(proposal.confidence)).toBe(false);
  });

  it("drops stored tags when suggest fails", () => {
    const item = row({ suggestions: stored });
    const proposal = proposalAfterSuggest(item, { ok: false, reason: "jev_error" });
    expect(proposal?.mode).toBe("manual");
    expect(proposal?.tags).toEqual([]);
    expect(proposal?.selectedTags).toEqual([]);
    expect(proposal?.jevError).toBe("jev_error");
    expect(proposal?.title).toBe("원제목");
    expect(proposal?.summary).toBe("원문");
  });

  it("maps a missing key to manual promote without chips", () => {
    const proposal = proposalAfterSuggest(row({ suggestions: stored }), {
      ok: false,
      reason: "key_missing",
    });
    expect(proposal?.jevError).toBe("key_missing");
    expect(proposal?.tags).toEqual([]);
  });

  it("returns null when the row is gone", () => {
    expect(proposalAfterSuggest(row(), { ok: false, reason: "not_found" })).toBeNull();
  });
});
