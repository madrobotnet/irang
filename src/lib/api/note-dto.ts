/** Client/shared DTOs for Rex note & capture API JSON (no domain imports). */

export type NoteStatusDto = "draft" | "confirmed" | "archived";

export type InboxSourceDto = "web" | "url" | "share" | "api";

export type NoteDto = {
  id: string;
  title: string;
  body: string;
  status: NoteStatusDto;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  purgeAt: string | null;
};

export type InboxItemDto = {
  id: string;
  title: string;
  body: string;
  source: InboxSourceDto;
  url: string | null;
  createdAt: string;
  promotedNoteId: string | null;
  discardedAt: string | null;
};

export type AttachmentDto = {
  id: string;
  noteId: string | null;
  inboxItemId: string | null;
  filename: string;
  mime: string;
  sizeBytes: number;
  createdAt: string;
};

export type ListNotesOk = {
  ok: true;
  notes: NoteDto[];
  nextCursor: string | null;
};

export type NoteOk = { ok: true; note: NoteDto };

export type TagSuggestionDto = {
  tag: string;
  probability: number;
};

export type CaptureSuggestionsDto = {
  tags: TagSuggestionDto[];
};

/** Rex Jev wire on capture/share 201 (see `src/domain/judgments/capture-api-wire.ts`). */
export type DuplicateHintDto = {
  relatedNoteId: string | null;
  choice: string;
  probability: number;
  confidence: number;
};

export type CaptureJudgmentFieldsDto = {
  suggestions: CaptureSuggestionsDto;
  duplicateHint: DuplicateHintDto | null;
};

export type CaptureNoteOk = CaptureJudgmentFieldsDto & {
  ok: true;
  target: "note";
  note: NoteDto;
};

export type CaptureInboxOk = CaptureJudgmentFieldsDto & {
  ok: true;
  target: "inbox";
  inboxItem: InboxItemDto;
};

export type CaptureShareOk = CaptureJudgmentFieldsDto & {
  ok: true;
  inboxItem: InboxItemDto;
};

export type CaptureOk = CaptureNoteOk | CaptureInboxOk;

export type InboxListOk = { ok: true; inboxItems: InboxItemDto[] };

export type InboxItemOk = { ok: true; inboxItem: InboxItemDto };

export type PromoteInboxOk = {
  ok: true;
  inboxItem: InboxItemDto;
  note: NoteDto;
};

export type AttachmentOk = { ok: true; attachment: AttachmentDto };

export type DeleteAttachmentOk = { ok: true };
