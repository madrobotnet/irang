import type { Pool } from "pg";
import type { StoredInboxSuggestions } from "@/domain/inbox/suggestions";
import type { InboxSource, NoteStatus } from "@/domain/notes/constants";
import type { AttachmentRecord, InboxItemRecord, NoteRecord } from "@/domain/notes/types";
import { mapAttachmentRow, mapInboxRow, mapIngestJobRow, mapNoteRow } from "./map-rows";
import type {
  ListIngestJobsQuery,
  ListInboxQuery,
  ListNotesQuery,
  NotesStore,
} from "./ports";

export class PostgresNotesStore implements NotesStore {
  constructor(private readonly pool: Pool) {}

  async createNote(input: {
    title: string;
    body: string;
    status: NoteStatus;
  }): Promise<NoteRecord> {
    const { rows } = await this.pool.query(
      `INSERT INTO notes (title, body, status)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [input.title, input.body, input.status],
    );
    return mapNoteRow(rows[0]);
  }

  async listNotes(query: ListNotesQuery): Promise<{ notes: NoteRecord[]; nextCursor: string | null }> {
    await this.purgeDueNotes(new Date());
    const params: unknown[] = [];
    const clauses: string[] = [];
    if (!query.includeDeleted) {
      clauses.push("deleted_at IS NULL");
    }
    if (query.status) {
      params.push(query.status);
      clauses.push(`status = $${params.length}`);
    }
    let cursorClause = "";
    if (query.cursor) {
      const cur = await this.getNoteById(query.cursor);
      if (cur) {
        params.push(cur.updatedAt, cur.id);
        cursorClause = `AND (updated_at, id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`;
      }
    }
    params.push(query.limit + 1);
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const { rows } = await this.pool.query(
      `SELECT * FROM notes ${where} ${cursorClause}
       ORDER BY updated_at DESC, id DESC
       LIMIT $${params.length}`,
      params,
    );
    const mapped = rows.map(mapNoteRow);
    let nextCursor: string | null = null;
    if (mapped.length > query.limit) {
      const last = mapped[query.limit - 1];
      nextCursor = last?.id ?? null;
      mapped.length = query.limit;
    }
    return { notes: mapped, nextCursor };
  }

  async peekNoteById(id: string): Promise<NoteRecord | null> {
    const { rows } = await this.pool.query(`SELECT * FROM notes WHERE id = $1`, [id]);
    return rows[0] ? mapNoteRow(rows[0]) : null;
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
    const sets: string[] = ["updated_at = now()"];
    const params: unknown[] = [];
    if (patch.title !== undefined) {
      params.push(patch.title);
      sets.push(`title = $${params.length}`);
    }
    if (patch.body !== undefined) {
      params.push(patch.body);
      sets.push(`body = $${params.length}`);
    }
    if (patch.status !== undefined) {
      params.push(patch.status);
      sets.push(`status = $${params.length}`);
    }
    params.push(id);
    const { rows } = await this.pool.query(
      `UPDATE notes SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING *`,
      params,
    );
    return rows[0] ? mapNoteRow(rows[0]) : null;
  }

  async softDeleteNote(id: string, deletedAt: Date, purgeAt: Date): Promise<NoteRecord | null> {
    const { rows } = await this.pool.query(
      `UPDATE notes
       SET deleted_at = $2, purge_at = $3, updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [id, deletedAt, purgeAt],
    );
    return rows[0] ? mapNoteRow(rows[0]) : null;
  }

  async restoreNote(id: string): Promise<NoteRecord | null> {
    const { rows } = await this.pool.query(
      `UPDATE notes
       SET deleted_at = NULL, purge_at = NULL, updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [id],
    );
    return rows[0] ? mapNoteRow(rows[0]) : null;
  }

  async hardDeleteNote(id: string): Promise<void> {
    await this.pool.query(`DELETE FROM notes WHERE id = $1`, [id]);
  }

  async purgeDueNotes(now: Date): Promise<number> {
    const { rowCount } = await this.pool.query(
      `DELETE FROM notes WHERE purge_at IS NOT NULL AND purge_at <= $1`,
      [now],
    );
    return rowCount ?? 0;
  }

  async createInboxItem(input: {
    title: string;
    body: string;
    source: InboxSource;
    url: string | null;
    suggestions?: StoredInboxSuggestions | null;
  }): Promise<InboxItemRecord> {
    const { rows } = await this.pool.query(
      `INSERT INTO inbox_items (title, body, source, url, suggestions)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       RETURNING *`,
      [
        input.title,
        input.body,
        input.source,
        input.url,
        input.suggestions ? JSON.stringify(input.suggestions) : null,
      ],
    );
    return mapInboxRow(rows[0]);
  }

  async listInboxItems(
    query: ListInboxQuery,
  ): Promise<{ items: InboxItemRecord[]; nextCursor: string | null }> {
    const params: unknown[] = [query.includeClosed];
    let cursorSql = "AND ($2::timestamptz IS NULL)";
    if (query.cursor) {
      const cur = await this.getInboxItemById(query.cursor);
      if (cur) {
        params.push(cur.createdAt, cur.id);
        cursorSql = `AND (created_at, id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`;
      } else {
        params.push(null);
      }
    } else {
      params.push(null);
    }
    params.push(query.limit + 1);
    const { rows } = await this.pool.query(
      `SELECT * FROM inbox_items
       WHERE ($1::boolean OR (discarded_at IS NULL AND promoted_note_id IS NULL))
       ${cursorSql}
       ORDER BY created_at DESC, id DESC
       LIMIT $${params.length}`,
      params,
    );
    const mapped = rows.map(mapInboxRow);
    let nextCursor: string | null = null;
    if (mapped.length > query.limit) {
      nextCursor = mapped[query.limit - 1]?.id ?? null;
      mapped.length = query.limit;
    }
    return { items: mapped, nextCursor };
  }

  async getInboxItemById(id: string): Promise<InboxItemRecord | null> {
    const { rows } = await this.pool.query(`SELECT * FROM inbox_items WHERE id = $1`, [id]);
    return rows[0] ? mapInboxRow(rows[0]) : null;
  }

  async setInboxSuggestions(
    id: string,
    suggestions: StoredInboxSuggestions,
  ): Promise<InboxItemRecord | null> {
    const { rows } = await this.pool.query(
      `UPDATE inbox_items SET suggestions = $2::jsonb WHERE id = $1 RETURNING *`,
      [id, JSON.stringify(suggestions)],
    );
    return rows[0] ? mapInboxRow(rows[0]) : null;
  }

  async promoteInboxItem(
    id: string,
    noteInput: { title: string; body: string; status: NoteStatus },
    options: { allowDiscarded: boolean },
  ): Promise<{ inbox: InboxItemRecord; note: NoteRecord } | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query(`SELECT * FROM inbox_items WHERE id = $1 FOR UPDATE`, [id]);
      if (!existing.rows[0]) {
        await client.query("ROLLBACK");
        return null;
      }
      const current = mapInboxRow(existing.rows[0]);
      if (current.promotedNoteId) {
        await client.query("ROLLBACK");
        return null;
      }
      if (current.discardedAt && !options.allowDiscarded) {
        await client.query("ROLLBACK");
        return null;
      }
      const noteInsert = await client.query(
        `INSERT INTO notes (title, body, status)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [noteInput.title, noteInput.body, noteInput.status],
      );
      const note = mapNoteRow(noteInsert.rows[0]);
      const { rows } = await client.query(
        `UPDATE inbox_items
         SET promoted_note_id = $2,
             discarded_at = CASE WHEN $3::boolean THEN NULL ELSE discarded_at END
         WHERE id = $1
         RETURNING *`,
        [id, note.id, options.allowDiscarded],
      );
      if (!rows[0]) {
        await client.query("ROLLBACK");
        return null;
      }
      await client.query("COMMIT");
      return { inbox: mapInboxRow(rows[0]), note };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async discardInboxItem(
    id: string,
    at: Date,
    options: { allowPromoted: boolean },
  ): Promise<InboxItemRecord | null> {
    const existing = await this.getInboxItemById(id);
    if (!existing) {
      return null;
    }
    if (existing.discardedAt) {
      return existing;
    }
    if (existing.promotedNoteId && !options.allowPromoted) {
      return null;
    }
    const { rows } = await this.pool.query(
      `UPDATE inbox_items SET discarded_at = $2
       WHERE id = $1 AND discarded_at IS NULL
         AND ($3::boolean OR promoted_note_id IS NULL)
       RETURNING *`,
      [id, at, options.allowPromoted],
    );
    return rows[0] ? mapInboxRow(rows[0]) : null;
  }

  async createAttachment(input: {
    noteId: string | null;
    inboxItemId: string | null;
    filename: string;
    mime: string;
    sizeBytes: number;
    storageKey: string;
  }): Promise<AttachmentRecord> {
    const { rows } = await this.pool.query(
      `INSERT INTO attachments (note_id, inbox_item_id, filename, mime, size_bytes, storage_key)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        input.noteId,
        input.inboxItemId,
        input.filename,
        input.mime,
        input.sizeBytes,
        input.storageKey,
      ],
    );
    return mapAttachmentRow(rows[0]);
  }

  async getAttachmentById(
    id: string,
  ): Promise<(AttachmentRecord & { storageKey: string }) | null> {
    const { rows } = await this.pool.query(`SELECT * FROM attachments WHERE id = $1`, [id]);
    if (!rows[0]) {
      return null;
    }
    const mapped = mapAttachmentRow(rows[0]);
    return { ...mapped, storageKey: rows[0].storage_key as string };
  }

  async deleteAttachment(id: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(`DELETE FROM attachments WHERE id = $1`, [id]);
    return (rowCount ?? 0) > 0;
  }

  async createIngestJob(input: {
    kind: string;
    status: string;
    payload: Record<string, unknown>;
    error?: string | null;
  }): Promise<import("@/domain/notes/types").IngestJobRecord> {
    const { rows } = await this.pool.query(
      `INSERT INTO ingest_jobs (kind, status, payload, error)
       VALUES ($1, $2, $3::jsonb, $4)
       RETURNING id, kind, status, payload, error, created_at, updated_at`,
      [input.kind, input.status, JSON.stringify(input.payload), input.error ?? null],
    );
    return mapIngestJobRow(rows[0]);
  }

  async getIngestJobById(id: string): Promise<import("@/domain/notes/types").IngestJobRecord | null> {
    const { rows } = await this.pool.query(
      `SELECT id, kind, status, payload, error, created_at, updated_at
       FROM ingest_jobs WHERE id = $1`,
      [id],
    );
    return rows[0] ? mapIngestJobRow(rows[0]) : null;
  }

  async listIngestJobs(
    query: ListIngestJobsQuery,
  ): Promise<{ jobs: import("@/domain/notes/types").IngestJobRecord[]; nextCursor: string | null }> {
    const params: unknown[] = [query.status];
    let cursorSql = "";
    if (query.cursor) {
      const cur = await this.getIngestJobById(query.cursor);
      if (cur) {
        params.push(cur.createdAt, cur.id);
        cursorSql = `AND (created_at, id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`;
      }
    }
    params.push(query.limit + 1);
    const { rows } = await this.pool.query(
      `SELECT id, kind, status, payload, error, created_at, updated_at
       FROM ingest_jobs
       WHERE ($1::text = 'all' OR status = $1)
       ${cursorSql}
       ORDER BY created_at DESC, id DESC
       LIMIT $${params.length}`,
      params,
    );
    const mapped = rows.map(mapIngestJobRow);
    let nextCursor: string | null = null;
    if (mapped.length > query.limit) {
      nextCursor = mapped[query.limit - 1]?.id ?? null;
      mapped.length = query.limit;
    }
    return { jobs: mapped, nextCursor };
  }

  async claimFailedIngestJob(id: string): Promise<import("@/domain/notes/types").IngestJobRecord | null> {
    const { rows } = await this.pool.query(
      `UPDATE ingest_jobs
       SET status = 'pending', updated_at = now()
       WHERE id = $1 AND status = 'failed'
       RETURNING id, kind, status, payload, error, created_at, updated_at`,
      [id],
    );
    return rows[0] ? mapIngestJobRow(rows[0]) : null;
  }

  async updateIngestJob(
    id: string,
    patch: { status: string; error: string | null; payload?: Record<string, unknown> },
  ): Promise<import("@/domain/notes/types").IngestJobRecord | null> {
    const { rows } = await this.pool.query(
      `UPDATE ingest_jobs
       SET status = $2,
           error = $3,
           payload = COALESCE($4::jsonb, payload),
           updated_at = now()
       WHERE id = $1
       RETURNING id, kind, status, payload, error, created_at, updated_at`,
      [id, patch.status, patch.error, patch.payload ? JSON.stringify(patch.payload) : null],
    );
    return rows[0] ? mapIngestJobRow(rows[0]) : null;
  }
}
