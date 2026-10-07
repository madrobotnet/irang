import { afterAll, afterEach, beforeEach, expect, test } from "bun:test";
import { embedText, vectorLiteral } from "@/lib/embed";
import { query } from "@/server/db";
import { createNote } from "@/server/notes/service";
import { closeDb, connectTestDatabase, resetData } from "@/server/test/db";
import { SEMANTIC_DIMENSIONS, SEMANTIC_MODEL_ID } from "./learned";
import { searchNotes } from "./service";

connectTestDatabase();
const originalUrl = process.env.EMBEDDING_BASE_URL;
const searchText = "작업 중에 마음이 자꾸 분산되는 현상";
const queryVector = Array.from({ length: SEMANTIC_DIMENSIONS }, (_, index) => index === 0 ? 1 : 0);
let modelAvailable = true;
const modelServer = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch: () => modelAvailable
    ? Response.json({ data: [{ index: 0, embedding: queryVector }] })
    : new Response("", { status: 503 }),
});

beforeEach(async () => {
  await resetData();
  modelAvailable = true;
  process.env.EMBEDDING_BASE_URL = modelServer.url.origin;
});
afterEach(() => {
  if (originalUrl === undefined) delete process.env.EMBEDDING_BASE_URL;
  else process.env.EMBEDDING_BASE_URL = originalUrl;
});
afterAll(async () => {
  await modelServer.stop(true);
  await closeDb();
});

async function seedCandidates() {
  const target = await createNote({ title: "집중 기록", body: "깊게 사고할 환경을 마련했다." });
  const distractor = await createNote({ title: "잡동사니", body: "중에라는 짧은 표현을 적었다." });
  const hashVector = embedText(searchText);
  // Independent retrievers disagree: a hash false positive and a learned match.
  await query("UPDATE notes SET search_embedding=$2::vector WHERE id=$1",
    [target.id, vectorLiteral(hashVector.map(value => -value))]);
  await query("UPDATE notes SET search_embedding=$2::vector WHERE id=$1",
    [distractor.id, vectorLiteral(hashVector)]);
  for (const note of [target, distractor]) {
    const vector = note.id === target.id ? queryVector : Array.from(
      { length: SEMANTIC_DIMENSIONS },
      (_, index) => index === 0 ? 0.25 : index === 1 ? Math.sqrt(1 - 0.25 ** 2) : 0,
    );
    await query(
      `INSERT INTO note_semantic_index(note_id,model_id,source_hash,complete)
       SELECT id,$2,md5(title || E'\\n' || body),true FROM notes WHERE id=$1`,
      [note.id, SEMANTIC_MODEL_ID],
    );
    await query(
      `INSERT INTO note_passages(note_id,model_id,source_hash,ordinal,heading,start_line,end_line,content,embedding)
       SELECT id,$2,md5(title || E'\\n' || body),0,'',1,1,body,$3::vector FROM notes WHERE id=$1`,
      [note.id, SEMANTIC_MODEL_ID, JSON.stringify(vector)],
    );
  }
  return { target, distractor };
}

test("keeps a learned match ahead of hash-only overlap when the index is ready", async () => {
  // Given a fresh learned index and a competing approximate hash match.
  const { target } = await seedCandidates();
  // When the normal search path fuses retrieval results.
  const result = await searchNotes(searchText, { limit: 1 });
  // Then hash overlap cannot cast an extra vote that hides the learned match.
  expect(result.semanticIndex?.state).toBe("ready");
  expect(result.hits[0]?.noteId).toBe(target.id);
  expect(result.hits[0]?.matchedBy).toContain("learned");
});

test("retains approximate hash retrieval when the learned model is unavailable", async () => {
  // Given the same corpus while the optional model is unavailable.
  const { distractor } = await seedCandidates();
  modelAvailable = false;
  // When the normal search path falls back.
  const result = await searchNotes(searchText, { limit: 1 });
  // Then the model-free result remains available without a learned claim.
  expect(result.semanticIndex?.state).toBe("unavailable");
  expect(result.hits[0]?.noteId).toBe(distractor.id);
  expect(result.hits[0]?.matchedBy).not.toContain("learned");
});
