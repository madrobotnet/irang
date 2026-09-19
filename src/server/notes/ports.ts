import type {
  AttachmentRecord,
  InboxItemRecord,
  IngestJobRecord,
  NoteRecord,
} from "@/domain/notes/types";
import type { InboxSource, NoteStatus } from "@/domain/notes/constants";

export type ListNotesQuery = {
  limit: number;
  cursor?: string;
  status?: NoteStatus;
  includeDeleted: boolean;
};

export type NotesStore = {
  createNote(input: {
    title: string;
    body: string;
    status: NoteStatus;
  }): Promise<NoteRecord>;
  listNotes(query: ListNotesQuery): Promise<{ notes: NoteRecord[]; nextCursor: string | null }>;
  getNoteById(id: string): Promise<NoteRecord | null>;
  /** Fetch without running purge side effects (restore path). */
  peekNoteById(id: string): Promise<NoteRecord | null>;
  updateNote(
    id: string,
    patch: { title?: string; body?: string; status?: NoteStatus },
  ): Promise<NoteRecord | null>;
  softDeleteNote(id: string, deletedAt: Date, purgeAt: Date): Promise<NoteRecord | null>;
  restoreNote(id: string): Promise<NoteRecord | null>;
  hardDeleteNote(id: string): Promise<void>;
  purgeDueNotes(now: Date): Promise<number>;

  createInboxItem(input: {
    title: string;
    body: string;
    source: InboxSource;
    url: string | null;
  }): Promise<InboxItemRecord>;
  listInboxItems(limit: number): Promise<InboxItemRecord[]>;
  getInboxItemById(id: string): Promise<InboxItemRecord | null>;
  promoteInboxItem(
    id: string,
    note: { title: string; body: string; status: NoteStatus },
  ): Promise<{ inbox: InboxItemRecord; note: NoteRecord } | null>;
  discardInboxItem(id: string, at: Date): Promise<InboxItemRecord | null>;

  createAttachment(input: {
    noteId: string | null;
    inboxItemId: string | null;
    filename: string;
    mime: string;
    sizeBytes: number;
    storageKey: string;
  }): Promise<AttachmentRecord>;
  getAttachmentById(id: string): Promise<(AttachmentRecord & { storageKey: string }) | null>;
  deleteAttachment(id: string): Promise<boolean>;

  createIngestJob(input: {
    kind: string;
    status: string;
    payload: Record<string, unknown>;
    error?: string | null;
  }): Promise<IngestJobRecord>;
};
