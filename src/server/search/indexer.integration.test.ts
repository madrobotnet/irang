import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test";
import { query } from "@/server/db";
import { createNote } from "@/server/notes/service";
import { closeDb, connectTestDatabase, resetData } from "@/server/test/db";
import { chunkMarkdown } from "./chunks";
import { runSemanticIndexBatch } from "./indexer";
import { SEMANTIC_DIMENSIONS, SEMANTIC_MODEL_ID } from "./learned";
import { indexStatus } from "./passages";
import { relatedNotes, searchNotes } from "./service";

connectTestDatabase();
const originalFetch = globalThis.fetch;
const originalUrl = process.env.EMBEDDING_BASE_URL;
beforeEach(async () => {
  await resetData();
  process.env.EMBEDDING_BASE_URL = "http://localhost:18431";
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.EMBEDDING_BASE_URL;
  else process.env.EMBEDDING_BASE_URL = originalUrl;
});
afterAll(closeDb);

function embeddingServer(onRequest: () => Promise<void> = async () => {}) {
  globalThis.fetch = Object.assign(async (_url: unknown, options?: RequestInit) => {
    const request = JSON.parse(String(options?.body));
    await onRequest();
    return Response.json({
      data: request.input.map((_input: string, index: number) => ({
        index,
        embedding: Array.from({ length: SEMANTIC_DIMENSIONS }, (_, coordinate) => coordinate === index % SEMANTIC_DIMENSIONS ? 1 : 0),
      })),
    });
  }, { preconnect: originalFetch.preconnect });
}

describe("durable passage indexing", () => {
  test("resumes bounded batches and completes idempotently", async () => {
    embeddingServer();
    const body = Array.from({ length: 12 }, (_, index) => `## Heading ${index}\n${"a".repeat(1800)}`).join("\n\n");
    const note = await createNote({ title: "Long note", body });
    const count = chunkMarkdown(body).length;
    expect(count).toBeGreaterThan(8);
    expect(await runSemanticIndexBatch()).toBe(1);
    expect((await indexStatus(true)).state).toBe("indexing");
    for (let index = 1; index < count; index++) expect(await runSemanticIndexBatch()).toBe(1);
    expect(await runSemanticIndexBatch()).toBe(0);
    expect(await indexStatus(true)).toMatchObject({ state: "ready", indexedNotes: 1, totalNotes: 1 });
    const rows = await query<{ count: string; model: string }>(
      "SELECT count(*)::text AS count,min(model_id) AS model FROM note_passages WHERE note_id=$1", [note.id],
    );
    expect(rows[0]).toEqual({ count: String(count), model: SEMANTIC_MODEL_ID });
  });

  test("does not publish inference that raced a note edit", async () => {
    const note = await createNote({ title: "Before", body: "Original" });
    embeddingServer(async () => {
      await query("UPDATE notes SET body='Changed' WHERE id=$1", [note.id]);
    });
    expect(await runSemanticIndexBatch()).toBe(0);
    expect((await query("SELECT * FROM note_passages"))).toEqual([]);
    embeddingServer();
    expect(await runSemanticIndexBatch()).toBe(1);
    expect((await query<{ content: string }>("SELECT content FROM note_passages"))[0]?.content).toBe("Changed");
  });

  test("archive, trash and purge stay excluded; restore reuses only fresh passages", async () => {
    embeddingServer();
    const note = await createNote({ title: "Lifecycle", body: "Text" });
    await runSemanticIndexBatch();
    await query("UPDATE notes SET status='archived',body='Changed archive' WHERE id=$1", [note.id]);
    expect(await runSemanticIndexBatch()).toBe(0);
    expect((await indexStatus(true)).totalNotes).toBe(0);
    await query("UPDATE notes SET status='draft' WHERE id=$1", [note.id]);
    expect((await indexStatus(true)).indexedNotes).toBe(0);
    expect(await runSemanticIndexBatch()).toBe(1);
    await query("UPDATE notes SET deleted_at=now() WHERE id=$1", [note.id]);
    expect((await indexStatus(true)).totalNotes).toBe(0);
    await query("UPDATE notes SET body='Changed trash' WHERE id=$1", [note.id]);
    expect(await runSemanticIndexBatch()).toBe(0);
    await query("UPDATE notes SET deleted_at=NULL WHERE id=$1", [note.id]);
    expect((await indexStatus(true)).indexedNotes).toBe(0);
    expect(await runSemanticIndexBatch()).toBe(1);
    await query("DELETE FROM notes WHERE id=$1", [note.id]);
    expect(await query("SELECT * FROM note_passages")).toEqual([]);
    expect(await query("SELECT * FROM note_semantic_index")).toEqual([]);
  });

  test("an outage preserves saved text and resumable work", async () => {
    const note = await createNote({ title: "Saved offline", body: "Capture must survive" });
    globalThis.fetch = Object.assign(async () => new Response("", { status: 503 }), { preconnect: originalFetch.preconnect });
    await expect(runSemanticIndexBatch()).rejects.toThrow("Local embeddings unavailable");
    expect((await indexStatus(false)).state).toBe("unavailable");
    expect((await query<{ body: string }>("SELECT body FROM notes WHERE id=$1", [note.id]))[0]?.body).toBe("Capture must survive");
    embeddingServer();
    expect(await runSemanticIndexBatch()).toBe(1);
  });

  test("learned retrieval needs no lexical overlap but obeys freshness, tags and visibility", async () => {
    embeddingServer();
    const note = await createNote({ title: "집중", body: "알림을 끄고 조용히 일한다", tags: ["업무"] });
    await runSemanticIndexBatch();
    const result = await searchNotes("방해를 줄이는 방법", { tag: "#업무" });
    expect(result.hits[0]?.noteId).toBe(note.id);
    expect(result.hits[0]?.matchedBy).toContain("learned");
    expect(result.hits[0]?.passage?.startLine).toBe(1);
    expect((await searchNotes("방해", { tag: "개인" })).hits).toEqual([]);
    await query("UPDATE notes SET body='새 본문' WHERE id=$1", [note.id]);
    expect((await searchNotes("방해")).hits.some((hit) => hit.matchedBy.includes("learned"))).toBe(false);
    await runSemanticIndexBatch();
    await query("UPDATE notes SET status='archived' WHERE id=$1", [note.id]);
    expect((await searchNotes("방해")).hits).toEqual([]);
  });

  test("related notes carry learned evidence and never score another model identity", async () => {
    embeddingServer();
    const source = await createNote({ title: "Source", body: "Original" });
    const target = await createNote({ title: "Target", body: "# Section\nDifferent" });
    await runSemanticIndexBatch();
    await runSemanticIndexBatch();
    const result = await relatedNotes(source.id);
    expect(result[0]?.id).toBe(target.id);
    expect(result[0]?.matchedBy).toEqual(["learned"]);
    expect(result[0]?.passage?.heading).toBe("Section");
    await query("UPDATE note_passages SET model_id='incompatible-model'");
    expect((await searchNotes("Unrelated meaning")).hits.some((hit) => hit.matchedBy.includes("learned"))).toBe(false);
  });

  test("malformed model output leaves exact lexical search usable without a learned claim", async () => {
    const note = await createNote({ title: "정확한 이름", body: "Saved" });
    globalThis.fetch = Object.assign(async () => Response.json({ data: [{ index: 0, embedding: [1, 0] }] }), { preconnect: originalFetch.preconnect });
    const result = await searchNotes("정확한 이름");
    expect(result.hits[0]?.noteId).toBe(note.id);
    expect(result.hits[0]?.matchedBy).not.toContain("learned");
    expect(result.semanticIndex?.state).toBe("unavailable");
  });
});
