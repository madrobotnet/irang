import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type { InboxSource, NoteStatus } from "@/domain/notes/constants";
import type { AttachmentRecord, InboxItemRecord, NoteRecord } from "@/domain/notes/types";
import { mapAttachmentRow, mapInboxRow, mapNoteRow } from "./map-rows";
import type { ListNotesQuery, NotesStore } from "./ports";

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
  }): Promise<InboxItemRecord> {
    const { rows } = await this.pool.query(
      `INSERT INTO inbox_items (title, body, source, url)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.title, input.body, input.source, input.url],
    );
    return mapInboxRow(rows[0]);
  }

  async listInboxItems(limit: number): Promise<InboxItemRecord[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM inbox_items
       WHERE discarded_at IS NULL AND promoted_note_id IS NULL
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit],
    );
    return rows.map(mapInboxRow);
  }

  async getInboxItemById(id: string): Promise<InboxItemRecord | null> {
    const { rows } = await this.pool.query(`SELECT * FROM inbox_items WHERE id = $1`, [id]);
    return rows[0] ? mapInboxRow(rows[0]) : null;
  }

  async promoteInboxItem(
    id: string,
    noteInput: { title: string; body: string; status: NoteStatus },
  ): Promise<{ inbox: InboxItemRecord; note: NoteRecord } | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const noteInsert = await client.query(
        `INSERT INTO notes (title, body, status)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [noteInput.title, noteInput.body, noteInput.status],
      );
      const note = mapNoteRow(noteInsert.rows[0]);
      const { rows } = await client.query(
        `UPDATE inbox_items SET promoted_note_id = $2 WHERE id = $1 RETURNING *`,
        [id, note.id],
      );
      if (!rows[0]) {
        await client.query("ROLLBACK");
        return null;
      }
      await client.query("COMMIT");
      return { inbox: mapInboxRow(rows[0]), note };
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async discardInboxItem(id: string, at: Date): Promise<InboxItemRecord | null> {
    const { rows } = await this.pool.query(
      `UPDATE inbox_items SET discarded_at = $2 WHERE id = $1 RETURNING *`,
      [id, at],
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
    const row = rows[0];
    return {
      id: row.id,
      kind: row.kind,
      status: row.status,
      payload: row.payload as Record<string, unknown>,
      error: row.error,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}
