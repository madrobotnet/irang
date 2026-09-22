import { randomUUID } from "node:crypto";
import { getDb } from "../../db/client";
import { RESTORE_WINDOW_MS, parseDeletedAtRow, parseNoteRow } from "./schema";
import type { CreateNoteInput, Note, NoteId, UpdateNoteInput } from "./schema";

export async function createNote(input: CreateNoteInput, now = new Date()): Promise<Note> {
  const [row] = await getDb()`
    INSERT INTO notes (id, title, body, created_at, updated_at, deleted_at)
    VALUES (${randomUUID()}, ${input.title}, ${input.body}, ${now}, ${now}, NULL)
    RETURNING id, title, body, created_at AS "createdAt", updated_at AS "updatedAt", deleted_at AS "deletedAt"
  `;
  return parseNoteRow(row);
}

export async function getActiveNote(id: NoteId): Promise<Note | null> {
  const [row] = await getDb()`
    SELECT id, title, body, created_at AS "createdAt", updated_at AS "updatedAt", deleted_at AS "deletedAt"
    FROM notes WHERE id = ${id} AND deleted_at IS NULL
  `;
  return row === undefined ? null : parseNoteRow(row);
}

export async function listActiveNotes(): Promise<readonly Note[]> {
  const rows = await getDb()`
    SELECT id, title, body, created_at AS "createdAt", updated_at AS "updatedAt", deleted_at AS "deletedAt"
    FROM notes WHERE deleted_at IS NULL ORDER BY created_at DESC
  `;
  return rows.map(parseNoteRow);
}

export async function updateNote(id: NoteId, input: UpdateNoteInput, now = new Date()): Promise<Note | null> {
  const [row] = await getDb()`
    UPDATE notes SET title = ${input.title}, body = ${input.body}, updated_at = ${now}
    WHERE id = ${id} AND deleted_at IS NULL
    RETURNING id, title, body, created_at AS "createdAt", updated_at AS "updatedAt", deleted_at AS "deletedAt"
  `;
  return row === undefined ? null : parseNoteRow(row);
}

export async function softDeleteNote(id: NoteId, now = new Date()): Promise<boolean> {
  const [row] = await getDb()`
    UPDATE notes SET deleted_at = ${now} WHERE id = ${id} AND deleted_at IS NULL RETURNING id
  `;
  return row !== undefined;
}

export type RestoreResult =
  | { readonly kind: "restored"; readonly note: Note }
  | { readonly kind: "not_found" }
  | { readonly kind: "expired" };

export async function restoreNote(id: NoteId, now = new Date()): Promise<RestoreResult> {
  const [existing] = await getDb()`SELECT deleted_at AS "deletedAt" FROM notes WHERE id = ${id}`;
  if (existing === undefined) return { kind: "not_found" };
  const deletedAt = parseDeletedAtRow(existing);
  if (deletedAt === null) return { kind: "not_found" };
  if (now.getTime() - deletedAt.getTime() > RESTORE_WINDOW_MS) return { kind: "expired" };
  const [row] = await getDb()`
    UPDATE notes SET deleted_at = NULL WHERE id = ${id}
    RETURNING id, title, body, created_at AS "createdAt", updated_at AS "updatedAt", deleted_at AS "deletedAt"
  `;
  if (row === undefined) return { kind: "not_found" };
  return { kind: "restored", note: parseNoteRow(row) };
}

export async function listTrash(now = new Date()): Promise<readonly Note[]> {
  const cutoff = new Date(now.getTime() - RESTORE_WINDOW_MS);
  const rows = await getDb()`
    SELECT id, title, body, created_at AS "createdAt", updated_at AS "updatedAt", deleted_at AS "deletedAt"
    FROM notes WHERE deleted_at IS NOT NULL AND deleted_at >= ${cutoff}
    ORDER BY deleted_at DESC
  `;
  return rows.map(parseNoteRow);
}

export async function purgeExpiredNotes(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - RESTORE_WINDOW_MS);
  return getDb().begin(async (sql) => {
    await sql`
      DELETE FROM attachments
      WHERE note_id IN (SELECT id FROM notes WHERE deleted_at IS NOT NULL AND deleted_at < ${cutoff})
    `;
    const rows = await sql`DELETE FROM notes WHERE deleted_at IS NOT NULL AND deleted_at < ${cutoff} RETURNING id`;
    return rows.length;
  });
}
