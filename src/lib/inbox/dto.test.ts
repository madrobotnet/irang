import { describe, expect, it } from "vitest";
import type { InboxErrorCode } from "@/domain/inbox/errors";
import type { StoredInboxSuggestions } from "@/domain/inbox/suggestions";
import type { InboxItemRecord, IngestJobRecord, NoteRecord } from "@/domain/notes/types";
import {
  E3_INBOX_COLLECTION_PATH,
  E3_PROTECTED_API_ROUTES,
  e3InboxDiscardPath,
  e3InboxPromotePath,
} from "@/lib/auth/e3-gate-paths";
import type { InboxItemDto, InboxSuggestionsDto, NoteDto } from "@/lib/api/note-dto";
import type {
  DiscardInboxOk,
  InboxApiErrorCode,
  InboxCommandBody,
  InboxErrorBody,
  InboxListOk,
  InboxOnlyErrorCode,
  IngestJobDto,
  PromoteInboxOk,
  RefreshInboxSuggestionsOk,
  RetryIngestOk,
} from "./dto";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

const suggestionsMatchDomain: Equal<StoredInboxSuggestions, InboxSuggestionsDto> = true;
const itemMatchDomain: Equal<InboxItemRecord, InboxItemDto> = true;
const noteMatchDomain: Equal<NoteRecord, NoteDto> = true;
const jobMatchDomain: Equal<IngestJobRecord, IngestJobDto> = true;
const inboxErrorsMatchDomain: Equal<InboxErrorCode, InboxOnlyErrorCode> = true;

const inboxItem: InboxItemDto = {
  id: "item-1",
  title: "Clip",
  body: "Keep this.",
  source: "share",
  url: "https://example.com/clip",
  createdAt: "2026-09-22T00:00:00.000Z",
  promotedNoteId: null,
  discardedAt: null,
  suggestions: null,
};

const note: NoteDto = {
  id: "note-1",
  title: inboxItem.title,
  body: inboxItem.body,
  status: "draft",
  createdAt: inboxItem.createdAt,
  updatedAt: inboxItem.createdAt,
  deletedAt: null,
  purgeAt: null,
};

function listEnvelope(): InboxListOk {
  return { ok: true, inboxItems: [inboxItem], nextCursor: null };
}

function discardEnvelope(): DiscardInboxOk {
  return {
    ok: true,
    inboxItem: { ...inboxItem, discardedAt: "2026-09-22T01:00:00.000Z" },
  };
}

function promoteEnvelope(): PromoteInboxOk {
  return {
    ok: true,
    inboxItem: {
      ...inboxItem,
      promotedNoteId: note.id,
      suggestions: {
        tags: [{ tag: "idea", probability: 0.9 }],
        classification: {
          choice: "idea",
          probability: 0.9,
          confidence: 0.8,
          probabilities: {
            reference: 0.01,
            idea: 0.9,
            task: 0.02,
            project: 0.01,
            meeting: 0.01,
            technical: 0.01,
            personal: 0.01,
            unsorted: 0.03,
          },
        },
        judgedAt: "2026-09-22T00:00:00.000Z",
      },
    },
    note,
  };
}

describe("inbox envelopes", () => {
  it("keeps the shared item DTO equal to Rex's stored row", () => {
    expect(suggestionsMatchDomain).toBe(true);
    expect(itemMatchDomain).toBe(true);
    expect(noteMatchDomain).toBe(true);
    expect(jobMatchDomain).toBe(true);
    expect(inboxErrorsMatchDomain).toBe(true);
  });

  it("lists items with nextCursor and leaves a missing judgment null", () => {
    const body = listEnvelope();
    expect(body.nextCursor).toBeNull();
    expect(body.inboxItems[0]?.suggestions).toBeNull();
    expect(body.inboxItems[0]).not.toHaveProperty("tags");
    expect(body.inboxItems[0]).not.toHaveProperty("judgmentError");
  });

  it("names discard as ok plus inboxItem", () => {
    const body = discardEnvelope();
    expect(body.ok).toBe(true);
    expect(body.inboxItem.discardedAt).toBe("2026-09-22T01:00:00.000Z");
    expect(body).not.toHaveProperty("note");
  });

  it("names promote as ok plus inboxItem and a note without suggestions", () => {
    const body = promoteEnvelope();
    expect(body.inboxItem.promotedNoteId).toBe("note-1");
    expect(body.inboxItem.suggestions?.classification?.choice).toBe("idea");
    expect(body.note.status).toBe("draft");
    expect(body.note).not.toHaveProperty("suggestions");
    expect(body.note).not.toHaveProperty("tags");
  });

  it("types suggest and retry commands on the collection path", () => {
    const suggest: InboxCommandBody = { action: "suggest", id: inboxItem.id };
    const refresh: RefreshInboxSuggestionsOk = { ok: true, inboxItem };
    const retry: RetryIngestOk = {
      ok: true,
      target: "inbox",
      job: {
        id: "job-1",
        kind: "url_summary",
        status: "done",
        payload: { url: "https://example.com/clip", target: "inbox" },
        error: null,
        createdAt: inboxItem.createdAt,
        updatedAt: inboxItem.createdAt,
      },
      inboxItem,
      suggestions: { tags: [{ tag: "idea", probability: 0.8 }] },
      duplicateHint: null,
    };
    const missingKey: InboxErrorBody = { ok: false, code: "typesafe_misconfigured" };
    const failed: InboxErrorBody = { ok: false, code: "judgment_failed", jobId: "job-1" };
    const promoted: InboxApiErrorCode = "already_promoted";
    expect(E3_INBOX_COLLECTION_PATH).toBe("/api/inbox");
    expect(suggest.action).toBe("suggest");
    expect(refresh.inboxItem.suggestions).toBeNull();
    expect(retry.target).toBe("inbox");
    expect(retry).not.toHaveProperty("note");
    expect(missingKey.code).toBe("typesafe_misconfigured");
    expect(failed.code).toBe("judgment_failed");
    expect(promoted).toBe("already_promoted");
  });

  it("builds the gated promote and discard paths Rex mounted", () => {
    expect([...E3_PROTECTED_API_ROUTES]).toEqual([
      "/api/inbox",
      "/api/inbox/item-id/promote",
      "/api/inbox/item-id/discard",
    ]);
    expect(e3InboxPromotePath("item-id")).toBe("/api/inbox/item-id/promote");
    expect(e3InboxDiscardPath("abc")).toBe("/api/inbox/abc/discard");
  });
});
