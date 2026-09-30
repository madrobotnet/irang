import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { query } from "@/server/db";
import { createNote, getNote, getOrCreateDaily, trashNote, updateNote } from "@/server/notes/service";
import { closeDb, connectTestDatabase, resetData } from "@/server/test/db";
import { listTasks, toggleNoteTask } from "./service";

connectTestDatabase();
beforeEach(resetData);
afterAll(closeDb);

describe("task list", () => {
  test("lists open, done and all tasks from active notes only, newest note first", async () => {
    const older = await createNote({ title: "Older", body: "- [ ] old open\n- [x] old done" });
    const daily = await getOrCreateDaily("2026-09-30");
    await updateNote(daily.id, { body: "```\n- [ ] code\n```\n1. [ ] daily open" });
    const archived = await createNote({ title: "Archived", body: "- [ ] hidden" });
    await updateNote(archived.id, { archived: true });
    const trashed = await createNote({ title: "Trashed", body: "- [ ] gone" });
    await trashNote(trashed.id);

    const open = await listTasks("open");
    expect(open.truncated).toBe(false);
    expect(open.tasks.map((task) => [task.title, task.line, task.text, task.dailyDate])).toEqual([
      ["2026-09-30", 4, "daily open", "2026-09-30"],
      ["Older", 1, "old open", null],
    ]);
    expect(open.tasks[1]).toMatchObject({ noteId: older.id, done: false, noteUpdatedAt: older.updatedAt });
    expect((await listTasks("done")).tasks.map((task) => task.text)).toEqual(["old done"]);
    expect((await listTasks("all")).tasks.map((task) => task.text)).toEqual(["daily open", "old open", "old done"]);
  });
});

describe("task toggle", () => {
  test("checks a task through the notes service and snapshots the previous body", async () => {
    const note = await createNote({ title: "Todo", body: "- [ ] one\r\n- [ ] two" });
    const result = await toggleNoteTask({ noteId: note.id, line: 2, expectedText: "two", done: true });
    expect(result.task).toEqual({ line: 2, text: "two", done: true });
    expect(result.note.body).toBe("- [ ] one\r\n- [x] two");
    const revisions = await query<{ reason: string; body: string }>(
      "SELECT reason,body FROM note_revisions WHERE note_id=$1", [note.id],
    );
    expect(revisions).toEqual([{ reason: "task-toggle", body: "- [ ] one\r\n- [ ] two" }]);
  });

  test("leaves the note untouched when the task already has the requested state", async () => {
    const note = await createNote({ title: "Todo", body: "- [x] done" });
    const result = await toggleNoteTask({ noteId: note.id, line: 1, expectedText: "done", done: true });
    expect(result.note.updatedAt).toBe(note.updatedAt);
    expect(result.note.body).toBe("- [x] done");
  });

  test("rejects a stale line with a mismatch conflict and keeps the body", async () => {
    const note = await createNote({ title: "Todo", body: "- [ ] renamed" });
    await expect(toggleNoteTask({ noteId: note.id, line: 1, expectedText: "original", done: true }))
      .rejects.toMatchObject({ code: "conflict", extra: { reason: "mismatch" } });
    expect((await getNote(note.id))?.body).toBe("- [ ] renamed");
  });

  test("rejects trashed and archived notes with distinct conflict reasons", async () => {
    const trashed = await createNote({ title: "Trashed", body: "- [ ] a" });
    await trashNote(trashed.id);
    const archived = await createNote({ title: "Archived", body: "- [ ] a" });
    await updateNote(archived.id, { archived: true });
    const input = { line: 1, expectedText: "a", done: true };
    await expect(toggleNoteTask({ ...input, noteId: trashed.id })).rejects.toMatchObject({ code: "conflict", extra: { reason: "trashed" } });
    await expect(toggleNoteTask({ ...input, noteId: archived.id })).rejects.toMatchObject({ code: "conflict", extra: { reason: "archived" } });
    await expect(toggleNoteTask({ ...input, noteId: crypto.randomUUID() })).rejects.toMatchObject({ code: "not_found" });
  });
});
