import { randomUUID } from "node:crypto";
import { getDb } from "../../db/client";

export type Suggestion = {
  readonly id: string;
  readonly label: string;
  readonly probability: number | null;
  readonly status: "pending" | "applied";
};

export async function saveSuggestion(inboxId: string, label: string, probability: number | null, now = new Date()): Promise<string> {
  const id = randomUUID();
  await getDb()`
    INSERT INTO judgments (id, subject_type, subject_id, kind, value, probability, created_at)
    VALUES (
      ${id}, 'inbox_item', ${inboxId}, 'tag',
      ${getDb().json({ label, status: "pending" })},
      ${probability}, ${now}
    )
  `;
  return id;
}

export async function listSuggestions(inboxId: string): Promise<readonly Suggestion[]> {
  const rows = await getDb()`
    SELECT id, value, probability FROM judgments
    WHERE subject_type = 'inbox_item' AND subject_id = ${inboxId} AND kind = 'tag'
    ORDER BY created_at DESC
  `;
  return rows.map((row) => {
    const value = row["value"] as { label?: string; status?: string };
    return {
      id: String(row["id"]),
      label: value.label ?? "",
      probability: row["probability"] === null ? null : Number(row["probability"]),
      status: value.status === "applied" ? "applied" : "pending",
    };
  });
}

export async function applySuggestion(id: string): Promise<{ readonly tag: string } | null> {
  return getDb().begin(async (sql) => {
    const [row] = await sql`
      SELECT subject_id, value FROM judgments
      WHERE id = ${id} AND kind = 'tag' AND subject_type = 'inbox_item'
    `;
    if (row === undefined) return null;
    const value = row["value"] as { label?: string; status?: string };
    const label = value.label ?? "";
    if (label === "") return null;
    const [item] = await sql`SELECT promoted_note_id FROM inbox_items WHERE id = ${row["subject_id"]}`;
    const noteId = item?.["promoted_note_id"];
    if (noteId === null || noteId === undefined) return null;
    const tagId = randomUUID();
    const [tag] = await sql`
      INSERT INTO tags (id, name) VALUES (${tagId}, ${label})
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `;
    if (tag === undefined) return null;
    await sql`
      INSERT INTO note_tags (note_id, tag_id) VALUES (${noteId}, ${tag["id"]})
      ON CONFLICT DO NOTHING
    `;
    await sql`
      UPDATE judgments SET value = ${sql.json({ label, status: "applied" })}
      WHERE id = ${id}
    `;
    return { tag: label };
  });
}
