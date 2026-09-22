/** Client/shared DTOs for Rex note & capture API JSON (no domain imports). */

export type NoteStatusDto = "draft" | "confirmed" | "archived";

export type InboxSourceDto = "web" | "url" | "share" | "api";

/**
 * Closed Choice labels Rex stores on an inbox item.
 * `unsorted` is the no-match class. A suggestion, never an applied tag.
 */
export const INBOX_CLASS_IDS = [
  "reference",
  "idea",
  "task",
  "project",
  "meeting",
  "technical",
  "personal",
  "unsorted",
] as const;

export type InboxClassIdDto = (typeof INBOX_CLASS_IDS)[number];

/** Choice answer: selected label, its probability, confidence, and the full distribution. */
export type InboxClassificationDto = {
  choice: InboxClassIdDto;
  probability: number;
  confidence: number;
  probabilities: Record<InboxClassIdDto, number>;
};

/** Noul answer for one proposed tag: probability of yes. No separate confidence. */
export type InboxTagSuggestionDto = {
  tag: string;
  probability: number;
};

/**
 * Jev output stored on the inbox row.
 * `null` on the item means no judgment was stored. Do not invent a class or tags.
 */
export type InboxSuggestionsDto = {
  tags: InboxTagSuggestionDto[];
  classification: InboxClassificationDto | null;
  judgedAt: string;
};

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
  suggestions: InboxSuggestionsDto | null;
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

export type InboxListOk = {
  ok: true;
  inboxItems: InboxItemDto[];
  nextCursor: string | null;
};

export type InboxItemOk = { ok: true; inboxItem: InboxItemDto };

export type PromoteInboxOk = {
  ok: true;
  inboxItem: InboxItemDto;
  note: NoteDto;
};

export type AttachmentOk = { ok: true; attachment: AttachmentDto };

export type DeleteAttachmentOk = { ok: true };
