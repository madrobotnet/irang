import { getDb } from "../../db/client";

export type SearchHit = {
  readonly id: string;
  readonly title: string;
  readonly body: string;
};

export type IndexStatus = "indexing" | "ready";

function likeTerm(query: string): string {
  return `%${query.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
}

export function embed(text: string): readonly number[] {
  const buckets = [0, 0, 0, 0, 0, 0, 0, 0];
  const chars = Array.from(text.normalize("NFKC").toLowerCase()).filter((char) => char.trim() !== "");
  for (const char of chars) {
    const index = (char.codePointAt(0) ?? 0) % 8;
    buckets[index] = (buckets[index] ?? 0) + 1;
  }
  const norm = Math.hypot(...buckets) || 1;
  return buckets.map((value) => value / norm);
}

function vectorLiteral(values: readonly number[]): string {
  return `[${values.join(",")}]`;
}

export async function indexStatus(): Promise<IndexStatus> {
  const [row] = await getDb()`
    SELECT count(*)::integer AS waiting
    FROM notes n
    LEFT JOIN search_docs d ON d.note_id = n.id AND d.indexed_at IS NOT NULL
    WHERE n.deleted_at IS NULL AND d.note_id IS NULL
  `;
  return Number(row?.["waiting"] ?? 0) > 0 ? "indexing" : "ready";
}

export async function runNightlyIndex(now = new Date()): Promise<number> {
  const notes = await getDb()`SELECT id, title, body FROM notes WHERE deleted_at IS NULL`;
  for (const note of notes) {
    const text = `${String(note["title"])} ${String(note["body"])}`;
    const embedding = vectorLiteral(embed(text));
    await getDb()`
      INSERT INTO search_docs (note_id, document, embedding, indexed_at)
      VALUES (
        ${note["id"]},
        to_tsvector('simple', ${text}),
        ${embedding}::vector,
        ${now}
      )
      ON CONFLICT (note_id) DO UPDATE
        SET document = EXCLUDED.document,
            embedding = EXCLUDED.embedding,
            indexed_at = EXCLUDED.indexed_at
    `;
  }
  return notes.length;
}

export async function keywordSearch(query: string, tag?: string): Promise<readonly SearchHit[]> {
  const term = likeTerm(query);
  const rows = await getDb()`
    SELECT n.id, n.title, n.body
    FROM notes n
    LEFT JOIN search_docs d ON d.note_id = n.id
    WHERE n.deleted_at IS NULL
      AND (
        n.title ILIKE ${term} ESCAPE '\\'
        OR n.body ILIKE ${term} ESCAPE '\\'
        OR d.document @@ plainto_tsquery('simple', ${query})
      )
      AND (
        ${tag ?? null}::text IS NULL
        OR EXISTS (
          SELECT 1 FROM note_tags nt
          JOIN tags t ON t.id = nt.tag_id
          WHERE nt.note_id = n.id AND t.name = ${tag ?? ""}
        )
      )
    ORDER BY
      CASE WHEN d.embedding IS NULL THEN 1 ELSE 0 END,
      d.embedding <=> ${vectorLiteral(embed(query))}::vector,
      n.updated_at DESC
  `;
  return rows.map((row) => ({
    id: String(row["id"]),
    title: String(row["title"]),
    body: String(row["body"]),
  }));
}
