import type { StoredInboxSuggestions } from "@/domain/inbox/suggestions";
import type { InboxSource, NoteStatus } from "./constants";

export type NoteRecord = {
  id: string;
  title: string;
  body: string;
  status: NoteStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  purgeAt: string | null;
};

export type InboxItemRecord = {
  id: string;
  title: string;
  body: string;
  source: InboxSource;
  url: string | null;
  createdAt: string;
  promotedNoteId: string | null;
  discardedAt: string | null;
  /** Jev classification and tag proposals. Never an applied tag set. */
  suggestions: StoredInboxSuggestions | null;
};

export type AttachmentRecord = {
  id: string;
  noteId: string | null;
  inboxItemId: string | null;
  filename: string;
  mime: string;
  sizeBytes: number;
  createdAt: string;
};

export type IngestJobRecord = {
  id: string;
  kind: string;
  status: string;
  payload: Record<string, unknown>;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};
