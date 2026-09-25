import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HOME_RECENT_NOTES_LIMIT } from "@/domain/home/summary";
import { ensureAuthSchema, getPool, resetPoolForTests } from "@/server/db/postgres";
import { ensureNotesSchema, resetNotesSchemaForTests } from "@/server/notes/schema";
import { PostgresNotesStore } from "@/server/notes/postgres-store";
import { resetNotesRuntimeForTests, setNotesStoreForTests } from "@/server/notes/runtime";
import { handleGetHome } from "./http";

const databaseUrl = process.env.DATABASE_URL ?? "";
const runIntegration = process.env.RUN_PG_INTEGRATION === "1" && databaseUrl.length > 0;

describe.runIf(runIntegration)("Postgres home summary", () => {
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

  it("matches live notes ordered by updated_at and the pending inbox count", async () => {
    const pool = getPool(databaseUrl);
    const store = new PostgresNotesStore(pool);
    setNotesStoreForTests(store);

    const marker = `home-live-${Date.now()}`;
    const deletedTitle = `home-deleted-${Date.now()}`;
    const live = await store.createNote({ title: marker, body: "kept", status: "confirmed" });
    const gone = await store.createNote({ title: deletedTitle, body: "dropped", status: "draft" });
    await store.softDeleteNote(gone.id, new Date(), new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    await pool.query(`UPDATE notes SET updated_at = $2 WHERE id = $1`, [
      live.id,
      "2099-06-15T12:00:00.000Z",
    ]);
    await pool.query(`UPDATE notes SET updated_at = $2 WHERE id = $1`, [
      gone.id,
      "2099-12-01T12:00:00.000Z",
    ]);

    await store.createInboxItem({ title: "pending-home", body: "", source: "api", url: null });
    const discarded = await store.createInboxItem({
      title: "discarded-home",
      body: "",
      source: "web",
      url: null,
    });
    await store.discardInboxItem(discarded.id, new Date(), { allowPromoted: false });

    const response = await handleGetHome();
    expect(response.status).toBe(200);

    const notes = await pool.query<{ id: string; title: string; updated_at: Date }>(
      `SELECT id, title, updated_at
       FROM notes
       WHERE deleted_at IS NULL
       ORDER BY updated_at DESC, id DESC
       LIMIT $1`,
      [HOME_RECENT_NOTES_LIMIT],
    );
    const count = await pool.query<{ count: number }>(
      `SELECT count(*)::int AS count
       FROM inbox_items
       WHERE discarded_at IS NULL AND promoted_note_id IS NULL`,
    );

    const body = (await response.json()) as {
      state: string;
      inboxBadge: { count: number };
      recentNotes: { id: string; title: string; updatedAt: string }[];
    };
    expect(body.state).toBe("ready");
    expect(body.recentNotes.map((note) => note.id)).toEqual(notes.rows.map((row) => row.id));
    expect(body.recentNotes.map((note) => note.updatedAt)).toEqual(
      notes.rows.map((row) => row.updated_at.toISOString()),
    );
    expect(body.recentNotes[0]).toEqual({
      id: live.id,
      title: marker,
      updatedAt: "2099-06-15T12:00:00.000Z",
    });
    expect(body.recentNotes.some((note) => note.id === gone.id)).toBe(false);
    expect(body.inboxBadge.count).toBe(count.rows[0]?.count);
  });
});
