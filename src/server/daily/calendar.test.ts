import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { getOrCreateDaily, trashNote, updateNote } from "@/server/notes/service";
import { closeDb, connectTestDatabase, resetData } from "@/server/test/db";
import { listDailyMonth } from "./calendar";

connectTestDatabase();
beforeEach(resetData);
afterAll(closeDb);

describe("daily calendar", () => {
  test("returns the month's daily notes in date order, keeping archived and dropping trashed ones", async () => {
    const last = await getOrCreateDaily("2026-09-30");
    const first = await getOrCreateDaily("2026-09-01");
    const archived = await getOrCreateDaily("2026-09-15");
    await updateNote(archived.id, { archived: true });
    await trashNote((await getOrCreateDaily("2026-09-20")).id);
    await getOrCreateDaily("2026-08-31");
    await getOrCreateDaily("2026-10-01");

    expect(await listDailyMonth("2026-09")).toEqual({
      month: "2026-09",
      days: [
        { date: "2026-09-01", noteId: first.id },
        { date: "2026-09-15", noteId: archived.id },
        { date: "2026-09-30", noteId: last.id },
      ],
    });
  });

  test("covers the full last day of December", async () => {
    const note = await getOrCreateDaily("2026-12-31");
    expect((await listDailyMonth("2026-12")).days).toEqual([{ date: "2026-12-31", noteId: note.id }]);
  });
});
