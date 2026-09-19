import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ensureAuthSchema, getPool, resetPoolForTests } from "../db/postgres";
import { ensureNotesSchema, resetNotesSchemaForTests } from "./schema";
import { PostgresNotesStore } from "./postgres-store";
import { setNotesStoreForTests, resetNotesRuntimeForTests } from "./runtime";
import { handleCreateNote, handleListNotes } from "./http";

const databaseUrl = process.env.DATABASE_URL ?? "";
const runIntegration = process.env.RUN_PG_INTEGRATION === "1" && databaseUrl.length > 0;

describe.runIf(runIntegration)("Postgres notes schema", () => {
  beforeAll(async () => {
    resetPoolForTests();
    resetNotesSchemaForTests();
    await ensureAuthSchema(databaseUrl);
    await ensureNotesSchema(databaseUrl);
    setNotesStoreForTests(new PostgresNotesStore(getPool(databaseUrl)));
  });

  afterAll(() => {
    resetNotesRuntimeForTests();
    resetPoolForTests();
  });

  it("persists notes through handlers", async () => {
    const create = await handleCreateNote(
      new Request("http://localhost/api/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "PG", body: "round trip" }),
      }),
    );
    expect(create.status).toBe(201);
    const list = await handleListNotes(new Request("http://localhost/api/notes"));
    expect(list.status).toBe(200);
    const body = (await list.json()) as { notes: { title: string }[] };
    expect(body.notes.some((n) => n.title === "PG")).toBe(true);
  });
});
