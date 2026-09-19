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

export type CaptureOk =
  | { ok: true; target: "note"; note: NoteDto }
  | { ok: true; target: "inbox"; inboxItem: InboxItemDto };

export type InboxListOk = { ok: true; inboxItems: InboxItemDto[] };

export type InboxItemOk = { ok: true; inboxItem: InboxItemDto };

export type PromoteInboxOk = {
  ok: true;
  inboxItem: InboxItemDto;
  note: NoteDto;
};

export type AttachmentOk = { ok: true; attachment: AttachmentDto };

export type DeleteAttachmentOk = { ok: true };
