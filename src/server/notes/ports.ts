import type { StoredInboxSuggestions } from "@/domain/inbox/suggestions";
import type {
  AttachmentRecord,
  InboxItemRecord,
  IngestJobRecord,
  NoteRecord,
} from "@/domain/notes/types";
import type { InboxSource, NoteStatus } from "@/domain/notes/constants";

export type ListInboxQuery = {
  limit: number;
  cursor?: string;
  includeClosed: boolean;
};

export type IngestJobListStatus = "pending" | "failed" | "done" | "all";

export type ListIngestJobsQuery = {
  limit: number;
  cursor?: string;
  status: IngestJobListStatus;
};

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
    suggestions?: StoredInboxSuggestions | null;
  }): Promise<InboxItemRecord>;
  listInboxItems(query: ListInboxQuery): Promise<{
    items: InboxItemRecord[];
    nextCursor: string | null;
  }>;
  getInboxItemById(id: string): Promise<InboxItemRecord | null>;
  setInboxSuggestions(
    id: string,
    suggestions: StoredInboxSuggestions,
  ): Promise<InboxItemRecord | null>;
  promoteInboxItem(
    id: string,
    note: { title: string; body: string; status: NoteStatus },
    options: { allowDiscarded: boolean },
  ): Promise<{ inbox: InboxItemRecord; note: NoteRecord } | null>;
  discardInboxItem(
    id: string,
    at: Date,
    options: { allowPromoted: boolean },
  ): Promise<InboxItemRecord | null>;

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
  getIngestJobById(id: string): Promise<IngestJobRecord | null>;
  listIngestJobs(query: ListIngestJobsQuery): Promise<{
    jobs: IngestJobRecord[];
    nextCursor: string | null;
  }>;
  /** Move a failed job to pending. Returns null when it was not failed. */
  claimFailedIngestJob(id: string): Promise<IngestJobRecord | null>;
  updateIngestJob(
    id: string,
    patch: { status: string; error: string | null; payload?: Record<string, unknown> },
  ): Promise<IngestJobRecord | null>;
};
