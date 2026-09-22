import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { embedText } from "@/domain/search/embed";
import type { SearchFilters } from "@/domain/search/types";
import { ensureAuthSchema, getPool, resetPoolForTests } from "@/server/db/postgres";
import { handleCreateNote } from "@/server/notes/http";
import { ensureNotesSchema, resetNotesSchemaForTests } from "@/server/notes/schema";
import { PostgresNotesStore } from "@/server/notes/postgres-store";
import { resetNotesRuntimeForTests, setNotesStoreForTests } from "@/server/notes/runtime";
import { setSystemOneInvokerForTests } from "@/server/typesafe/runtime";
import type { SystemOneInvoker } from "@/server/typesafe/ports";
import { runOvernightIndexBatch } from "./batch";
import { handleSearch } from "./http";
import { PostgresSearchIndex } from "./postgres-index";
import { resetSearchRuntimeForTests, setSearchIndexForTests } from "./runtime";
import { ensureSearchSchema, resetSearchSchemaForTests } from "./schema";

const databaseUrl = process.env.DATABASE_URL ?? "";
const runIntegration = process.env.RUN_PG_INTEGRATION === "1" && databaseUrl.length > 0;

const invoker: SystemOneInvoker = {
  async systemOne(request) {
    const state = request.state as { candidates?: { id: string }[] };
    const ids = ["none", ...(state.candidates ?? []).map((candidate) => candidate.id)];
    const winner = state.candidates?.[0]?.id ?? "none";
    const probabilities: Record<string, number> = {};
    for (const id of ids) {
      probabilities[id] = id === winner ? 0.9 : 0.1 / Math.max(1, ids.length - 1);
    }
    if (ids.length === 1) {
      probabilities.none = 1;
    }
    return {
      model: "jev-latest",
      usage: { input_tokens: 1, output_tokens: 1 },
      answers: {
        ranking: { type: "choice", choice: winner, confidence: 0.9, probabilities },
        answersQuery: { type: "noul", noul: 0.66 },
      },
    } as never;
  },
};

describe.runIf(runIntegration)("Postgres hybrid search index", () => {
  beforeAll(async () => {
    resetPoolForTests();
    resetNotesSchemaForTests();
    resetSearchSchemaForTests();
    resetNotesRuntimeForTests();
    resetSearchRuntimeForTests();
    await ensureAuthSchema(databaseUrl);
    await ensureNotesSchema(databaseUrl);
    await ensureSearchSchema(databaseUrl);
    const pool = getPool(databaseUrl);
    setNotesStoreForTests(new PostgresNotesStore(pool));
    setSearchIndexForTests(new PostgresSearchIndex(pool));
    setSystemOneInvokerForTests(invoker);
    process.env.TYPESAFE_API_KEY = "test-key-not-used-with-mock";
  });

  afterAll(() => {
    setSystemOneInvokerForTests(null);
    delete process.env.TYPESAFE_API_KEY;
    resetNotesRuntimeForTests();
    resetSearchRuntimeForTests();
    resetPoolForTests();
  });

  it("searches by FTS before the batch and by pgvector after it", async () => {
    const marker = `tsvector-${Date.now()}`;
    const title = "pgvector hybrid";
    const noteBody = `keyword ${marker} plus an embedding column`;
    const created = await handleCreateNote(
      new Request("http://localhost/api/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, body: noteBody }),
      }),
    );
    expect(created.status).toBe(201);
    const id = ((await created.json()) as { note: { id: string } }).note.id;
    const index = new PostgresSearchIndex(getPool(databaseUrl));
    const filters: SearchFilters = { from: null, to: null, status: null };
    const keyword = await index.keyword(marker, filters, 10);
    expect(keyword.some((doc) => doc.id === id)).toBe(true);
    const before = await index.counts();
    expect(before.pending).toBeGreaterThanOrEqual(1);
    const batch = await runOvernightIndexBatch(50);
    expect(batch.embedded).toBeGreaterThanOrEqual(1);
    const semantic = await index.semantic(embedText(`${title}\n${noteBody}`), filters, 5);
    const hit = semantic.find((doc) => doc.id === id);
    expect(hit?.score).toBeGreaterThan(0.99);
    const search = await handleSearch(new Request(`http://localhost/api/search?query=${marker}`));
    expect(search.status).toBe(200);
    const body = (await search.json()) as { results: { noteId: string }[]; ranking: { type: string } };
    expect(body.ranking.type).toBe("choice");
    expect(body.results.some((hit) => hit.noteId === id)).toBe(true);
  });
});
