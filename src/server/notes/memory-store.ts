import { randomUUID } from "node:crypto";
import { SOFT_DELETE_RETENTION_MS } from "@/domain/notes/constants";
import type { InboxSource, NoteStatus } from "@/domain/notes/constants";
import type {
  AttachmentRecord,
  InboxItemRecord,
  IngestJobRecord,
  NoteRecord,
} from "@/domain/notes/types";
import type { ListNotesQuery, NotesStore } from "./ports";

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
    };
    this.inbox.set(id, item);
    return item;
  }

  async listInboxItems(limit: number): Promise<InboxItemRecord[]> {
    const rows = [...this.inbox.values()].filter(
      (i) => !i.discardedAt && !i.promotedNoteId,
    );
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return rows.slice(0, limit);
  }

  async getInboxItemById(id: string): Promise<InboxItemRecord | null> {
    return this.inbox.get(id) ?? null;
  }

  async promoteInboxItem(
    id: string,
    noteInput: { title: string; body: string; status: NoteStatus },
  ): Promise<{ inbox: InboxItemRecord; note: NoteRecord } | null> {
    const item = this.inbox.get(id);
    if (!item) {
      return null;
    }
    const note = await this.createNote(noteInput);
    const updated: InboxItemRecord = {
      ...item,
      promotedNoteId: note.id,
    };
    this.inbox.set(id, updated);
    return { inbox: updated, note };
  }

  async discardInboxItem(id: string, at: Date): Promise<InboxItemRecord | null> {
    const item = this.inbox.get(id);
    if (!item) {
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
}

export function purgeAtFrom(deletedAt: Date): Date {
  return new Date(deletedAt.getTime() + SOFT_DELETE_RETENTION_MS);
}
