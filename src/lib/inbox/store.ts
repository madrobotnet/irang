import { randomUUID } from "node:crypto";
import { getDb } from "../../db/client";

export type InboxItem = {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly sourceUrl: string | null;
  readonly createdAt: Date;
};

export async function listOpenInbox(): Promise<readonly InboxItem[]> {
  const rows = await getDb()`
    SELECT id, title, body, source_url AS "sourceUrl", created_at AS "createdAt"
    FROM inbox_items
    WHERE discarded_at IS NULL AND promoted_note_id IS NULL
    ORDER BY created_at DESC
  `;
  return rows.map((row) => ({
    id: String(row["id"]),
    title: String(row["title"]),
    body: String(row["body"]),
    sourceUrl: row["sourceUrl"] === null ? null : String(row["sourceUrl"]),
    createdAt: row["createdAt"] as Date,
  }));
}

export async function promoteInboxItem(id: string, now = new Date()): Promise<{ readonly noteId: string } | null> {
  return getDb().begin(async (sql) => {
    const [item] = await sql`
      SELECT title, body FROM inbox_items
      WHERE id = ${id} AND discarded_at IS NULL AND promoted_note_id IS NULL
    `;
    if (item === undefined) return null;
    const noteId = randomUUID();
    await sql`
      INSERT INTO notes (id, title, body, created_at, updated_at, deleted_at)
      VALUES (${noteId}, ${item["title"]}, ${item["body"]}, ${now}, ${now}, NULL)
    `;
    await sql`UPDATE inbox_items SET promoted_note_id = ${noteId} WHERE id = ${id}`;
    return { noteId };
  });
}

export async function discardInboxItem(id: string, now = new Date()): Promise<boolean> {
  const [row] = await getDb()`
    UPDATE inbox_items SET discarded_at = ${now}
    WHERE id = ${id} AND discarded_at IS NULL AND promoted_note_id IS NULL
    RETURNING id
  `;
  return row !== undefined;
}
