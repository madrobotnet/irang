import { randomUUID } from "node:crypto";
import type { StoredInboxSuggestions } from "@/domain/inbox/suggestions";
import { SOFT_DELETE_RETENTION_MS } from "@/domain/notes/constants";
import type { InboxSource, NoteStatus } from "@/domain/notes/constants";
import type {
  AttachmentRecord,
  InboxItemRecord,
  IngestJobRecord,
  NoteRecord,
} from "@/domain/notes/types";
import type {
  ListIngestJobsQuery,
  ListInboxQuery,
  ListNotesQuery,
  NotesStore,
} from "./ports";

function nowIso(): string {
  return new Date().toISOString();
}

export class MemoryNotesStore implements NotesStore {
  notes = new Map<string, NoteRecord>();
  inbox = new Map<string, InboxItemRecord>();
  attachments = new Map<string, AttachmentRecord & { storageKey: string }>();
  ingestJobs = new Map<string, IngestJobRecord>();

  async createNote(input: {
    title: string;
    body: string;
    status: NoteStatus;
  }): Promise<NoteRecord> {
    const id = randomUUID();
    const t = nowIso();
    const note: NoteRecord = {
      id,
      title: input.title,
      body: input.body,
      status: input.status,
      createdAt: t,
      updatedAt: t,
      deletedAt: null,
      purgeAt: null,
    };
    this.notes.set(id, note);
    return note;
  }

  async listNotes(query: ListNotesQuery): Promise<{ notes: NoteRecord[]; nextCursor: string | null }> {
    await this.purgeDueNotes(new Date());
    let rows = [...this.notes.values()];
    if (!query.includeDeleted) {
      rows = rows.filter((n) => !n.deletedAt);
    }
    if (query.status) {
      rows = rows.filter((n) => n.status === query.status);
    }
    rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    let start = 0;
    if (query.cursor) {
      const idx = rows.findIndex((n) => n.id === query.cursor);
      start = idx >= 0 ? idx + 1 : 0;
    }
    const hasMore = rows.length > start + query.limit;
    const slice = rows.slice(start, start + query.limit);
    const nextCursor = hasMore ? slice[slice.length - 1]?.id ?? null : null;
    return { notes: slice, nextCursor };
  }

  async peekNoteById(id: string): Promise<NoteRecord | null> {
    return this.notes.get(id) ?? null;
  }

  async getNoteById(id: string): Promise<NoteRecord | null> {
    const note = await this.peekNoteById(id);
    if (note?.purgeAt && new Date(note.purgeAt) <= new Date()) {
      await this.hardDeleteNote(id);
      return null;
    }
    return note;
  }

  async updateNote(
    id: string,
    patch: { title?: string; body?: string; status?: NoteStatus },
  ): Promise<NoteRecord | null> {
    const note = this.notes.get(id);
    if (!note) {
      return null;
    }
    const updated: NoteRecord = {
      ...note,
      ...patch,
      updatedAt: nowIso(),
    };
    this.notes.set(id, updated);
    return updated;
  }

  async softDeleteNote(id: string, deletedAt: Date, purgeAt: Date): Promise<NoteRecord | null> {
    const note = this.notes.get(id);
    if (!note) {
      return null;
    }
    const updated: NoteRecord = {
      ...note,
      deletedAt: deletedAt.toISOString(),
      purgeAt: purgeAt.toISOString(),
      updatedAt: nowIso(),
    };
    this.notes.set(id, updated);
    return updated;
  }

  async restoreNote(id: string): Promise<NoteRecord | null> {
    const note = this.notes.get(id);
    if (!note) {
      return null;
    }
    const updated: NoteRecord = {
      ...note,
      deletedAt: null,
      purgeAt: null,
      updatedAt: nowIso(),
    };
    this.notes.set(id, updated);
    return updated;
  }

  async hardDeleteNote(id: string): Promise<void> {
    this.notes.delete(id);
    for (const [aid, att] of this.attachments) {
      if (att.noteId === id) {
        this.attachments.delete(aid);
      }
    }
    for (const [inboxId, item] of this.inbox) {
      if (item.promotedNoteId === id) {
        this.inbox.set(inboxId, { ...item, promotedNoteId: null });
      }
    }
  }

  async purgeDueNotes(now: Date): Promise<number> {
    let count = 0;
    for (const [id, note] of this.notes) {
      if (note.purgeAt && new Date(note.purgeAt) <= now) {
        await this.hardDeleteNote(id);
        count += 1;
      }
    }
    return count;
  }

  async createInboxItem(input: {
    title: string;
    body: string;
    source: InboxSource;
    url: string | null;
    suggestions?: StoredInboxSuggestions | null;
  }): Promise<InboxItemRecord> {
    const id = randomUUID();
    const item: InboxItemRecord = {
      id,
      title: input.title,
      body: input.body,
      source: input.source,
      url: input.url,
      createdAt: nowIso(),
      promotedNoteId: null,
      discardedAt: null,
      suggestions: input.suggestions ?? null,
    };
    this.inbox.set(id, item);
    return item;
  }

  async listInboxItems(
    query: ListInboxQuery,
  ): Promise<{ items: InboxItemRecord[]; nextCursor: string | null }> {
    let rows = [...this.inbox.values()];
    if (!query.includeClosed) {
      rows = rows.filter((item) => !item.discardedAt && !item.promotedNoteId);
    }
    rows.sort((a, b) => {
      const created = b.createdAt.localeCompare(a.createdAt);
      if (created !== 0) {
        return created;
      }
      return b.id.localeCompare(a.id);
    });
    let start = 0;
    if (query.cursor) {
      const idx = rows.findIndex((item) => item.id === query.cursor);
      start = idx >= 0 ? idx + 1 : 0;
    }
    const hasMore = rows.length > start + query.limit;
    const slice = rows.slice(start, start + query.limit);
    const nextCursor = hasMore ? slice[slice.length - 1]?.id ?? null : null;
    return { items: slice, nextCursor };
  }

  async getInboxItemById(id: string): Promise<InboxItemRecord | null> {
    return this.inbox.get(id) ?? null;
  }

  async setInboxSuggestions(
    id: string,
    suggestions: StoredInboxSuggestions,
  ): Promise<InboxItemRecord | null> {
    const item = this.inbox.get(id);
    if (!item) {
      return null;
    }
    const updated: InboxItemRecord = { ...item, suggestions };
    this.inbox.set(id, updated);
    return updated;
  }

  async promoteInboxItem(
    id: string,
    noteInput: { title: string; body: string; status: NoteStatus },
    options: { allowDiscarded: boolean },
  ): Promise<{ inbox: InboxItemRecord; note: NoteRecord } | null> {
    const item = this.inbox.get(id);
    if (!item || item.promotedNoteId) {
      return null;
    }
    if (item.discardedAt && !options.allowDiscarded) {
      return null;
    }
    const note = await this.createNote(noteInput);
    const updated: InboxItemRecord = {
      ...item,
      promotedNoteId: note.id,
      discardedAt: options.allowDiscarded ? null : item.discardedAt,
    };
    this.inbox.set(id, updated);
    return { inbox: updated, note };
  }

  async discardInboxItem(
    id: string,
    at: Date,
    options: { allowPromoted: boolean },
  ): Promise<InboxItemRecord | null> {
    const item = this.inbox.get(id);
    if (!item) {
      return null;
    }
    if (item.discardedAt) {
      return item;
    }
    if (item.promotedNoteId && !options.allowPromoted) {
      return null;
    }
    const updated: InboxItemRecord = {
      ...item,
      discardedAt: at.toISOString(),
    };
    this.inbox.set(id, updated);
    return updated;
  }

  async createAttachment(input: {
    noteId: string | null;
    inboxItemId: string | null;
    filename: string;
    mime: string;
    sizeBytes: number;
    storageKey: string;
  }): Promise<AttachmentRecord> {
    const id = randomUUID();
    const record: AttachmentRecord & { storageKey: string } = {
      id,
      noteId: input.noteId,
      inboxItemId: input.inboxItemId,
      filename: input.filename,
      mime: input.mime,
      sizeBytes: input.sizeBytes,
      createdAt: nowIso(),
      storageKey: input.storageKey,
    };
    this.attachments.set(id, record);
    return record;
  }

  async getAttachmentById(
    id: string,
  ): Promise<(AttachmentRecord & { storageKey: string }) | null> {
    return this.attachments.get(id) ?? null;
  }

  async deleteAttachment(id: string): Promise<boolean> {
    return this.attachments.delete(id);
  }

  async createIngestJob(input: {
    kind: string;
    status: string;
    payload: Record<string, unknown>;
    error?: string | null;
  }): Promise<IngestJobRecord> {
    const id = randomUUID();
    const t = nowIso();
    const job: IngestJobRecord = {
      id,
      kind: input.kind,
      status: input.status,
      payload: input.payload,
      error: input.error ?? null,
      createdAt: t,
      updatedAt: t,
    };
    this.ingestJobs.set(id, job);
    return job;
  }

  async getIngestJobById(id: string): Promise<IngestJobRecord | null> {
    return this.ingestJobs.get(id) ?? null;
  }

  async listIngestJobs(
    query: ListIngestJobsQuery,
  ): Promise<{ jobs: IngestJobRecord[]; nextCursor: string | null }> {
    let rows = [...this.ingestJobs.values()];
    if (query.status !== "all") {
      rows = rows.filter((job) => job.status === query.status);
    }
    rows.sort((a, b) => {
      const created = b.createdAt.localeCompare(a.createdAt);
      if (created !== 0) {
        return created;
      }
      return b.id.localeCompare(a.id);
    });
    let start = 0;
    if (query.cursor) {
      const idx = rows.findIndex((job) => job.id === query.cursor);
      start = idx >= 0 ? idx + 1 : 0;
    }
    const hasMore = rows.length > start + query.limit;
    const slice = rows.slice(start, start + query.limit);
    const nextCursor = hasMore ? slice[slice.length - 1]?.id ?? null : null;
    return { jobs: slice, nextCursor };
  }

  async claimFailedIngestJob(id: string): Promise<IngestJobRecord | null> {
    const job = this.ingestJobs.get(id);
    if (!job || job.status !== "failed") {
      return null;
    }
    const next: IngestJobRecord = { ...job, status: "pending", updatedAt: nowIso() };
    this.ingestJobs.set(id, next);
    return next;
  }

  async updateIngestJob(
    id: string,
    patch: { status: string; error: string | null; payload?: Record<string, unknown> },
  ): Promise<IngestJobRecord | null> {
    const job = this.ingestJobs.get(id);
    if (!job) {
      return null;
    }
    const next: IngestJobRecord = {
      ...job,
      status: patch.status,
      error: patch.error,
      payload: patch.payload ?? job.payload,
      updatedAt: nowIso(),
    };
    this.ingestJobs.set(id, next);
    return next;
  }
}

export function purgeAtFrom(deletedAt: Date): Date {
  return new Date(deletedAt.getTime() + SOFT_DELETE_RETENTION_MS);
}
