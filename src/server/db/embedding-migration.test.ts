import { afterAll, beforeEach, expect, test } from "bun:test";
import { embedText, vectorLiteral } from "@/lib/embed";
import { db, query } from "@/server/db";
import { createNote, restoreNote } from "@/server/notes/service";
import { relatedNotes, searchNotes } from "@/server/search/service";
import { closeDb, connectTestDatabase, resetData } from "@/server/test/db";

connectTestDatabase();
beforeEach(resetData);
afterAll(closeDb);

async function reopenAsOlderInstallation(): Promise<void> {
  // Emulate an initialized database that has not yet applied this upgrade,
  // then exercise the real startup migration runner (not copied migration SQL).
  await query("DELETE FROM schema_migrations WHERE id = '0004_reset_legacy_embeddings'");
  await closeDb();
  await db();
}

async function seedLegacy(title: string, vector: string): Promise<string> {
  const [row] = await query<{ id: string }>(
    `INSERT INTO notes (title,body,search_embedding,search_embedded_at,search_source_hash)
     VALUES ($1,'original body',$2::vector,now(),md5($1 || E'\\noriginal body')) RETURNING id`,
    [title, vector],
  );
  if (!row) throw new Error("Legacy note fixture was not created");
  return row.id;
}

test("startup invalidates incompatible vectors even when their content hash still matches", async () => {
  const source = await createNote({ title: "PostgreSQL 검색 설계", body: "검색 인덱스와 벡터 거리" });
  const title = "Unrelated cooking recipe";
  const legacy = await seedLegacy(title, vectorLiteral(embedText(`${source.title}\n${source.body}`)));

  await reopenAsOlderInstallation();
  const related = await relatedNotes(source.id);

  const [stored] = await query<{ fresh: boolean; title: string; body: string }>(
    "SELECT search_embedding=$2::vector AS fresh,title,body FROM notes WHERE id=$1",
    [legacy, vectorLiteral(embedText(`${title}\noriginal body`))],
  );
  expect(stored).toEqual({ fresh: true, title, body: "original body" });
  expect(related.find(note => note.id === legacy)?.score ?? 0).toBeLessThan(0.99);
});

test("clears archived and trashed vectors so restoration cannot revive the old algorithm", async () => {
  const stale = vectorLiteral(embedText("incompatible old vector"));
  const archived = await seedLegacy("Archived legacy note", stale);
  const trashed = await seedLegacy("Restored legacy note", stale);
  await query("UPDATE notes SET status='archived' WHERE id=$1", [archived]);
  await query("UPDATE notes SET deleted_at=now() WHERE id=$1", [trashed]);

  await reopenAsOlderInstallation();

  const cached = await query<{ embedding: string | null; hash: string | null; at: Date | null }>(
    `SELECT search_embedding::text AS embedding,search_source_hash AS hash,search_embedded_at AS at
     FROM notes WHERE id=ANY($1::uuid[])`, [[archived, trashed]],
  );
  expect(cached).toEqual([
    { embedding: null, hash: null, at: null },
    { embedding: null, hash: null, at: null },
  ]);
  await restoreNote(trashed);
  await relatedNotes(trashed);
  const [restored] = await query<{ fresh: boolean }>(
    "SELECT search_embedding=$2::vector AS fresh FROM notes WHERE id=$1",
    [trashed, vectorLiteral(embedText("Restored legacy note\noriginal body"))],
  );
  expect(restored?.fresh).toBe(true);
});

test("backfills only current vectors in bounded batches after an upgrade", async () => {
  const stale = vectorLiteral(embedText("incompatible old vector"));
  for (let index = 0; index < 40; index += 1) await seedLegacy(`Legacy batching ${index}`, stale);

  await reopenAsOlderInstallation();
  const first = await searchNotes("Legacy batching", { limit: 100 });

  const pending = await query<{ id: string }>("SELECT id FROM notes WHERE search_embedding IS NULL");
  expect(pending).toHaveLength(8);
  for (const row of pending) {
    expect(first.hits.find(hit => hit.noteId === row.id)?.matchedBy).not.toContain("semantic");
  }
  await searchNotes("Legacy batching", { limit: 100 });
  const rows = await query<{ id: string; title: string }>("SELECT id,title FROM notes");
  for (const row of rows) {
    const [stored] = await query<{ fresh: boolean }>(
      "SELECT search_embedding=$2::vector AS fresh FROM notes WHERE id=$1",
      [row.id, vectorLiteral(embedText(`${row.title}\noriginal body`))],
    );
    expect(stored?.fresh).toBe(true);
  }
});
