import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { query } from "@/server/db";
import { closeDb, connectTestDatabase, resetData } from "@/server/test/db";
import { createNote, getNoteLinks, getOrCreateDaily, updateNote } from "./service";

connectTestDatabase();
beforeEach(async () => {
  await resetData();
  await query("DELETE FROM note_templates");
});
afterAll(async () => {
  await query("DELETE FROM note_templates");
  await closeDb();
});

const setDailyDefault = (body: string) =>
  query("INSERT INTO note_templates (name,body,is_daily_default) VALUES ('daily',$1,true)", [body]);

describe("daily default template", () => {
  test("fills a new daily note exactly once, even under concurrent requests", async () => {
    const weekly = await createNote({ title: "주간 계획" });
    await setDailyDefault("# {{date}}\n\n#daily [[주간 계획]]");

    const notes = await Promise.all(Array.from({ length: 4 }, () => getOrCreateDaily("2026-09-29")));

    expect(new Set(notes.map((note) => note.id)).size).toBe(1);
    expect(notes[0]?.body).toBe("# 2026-09-29\n\n#daily [[주간 계획]]");
    expect(notes[0]?.tags).toEqual(["daily"]);
    expect((await getNoteLinks(weekly.id)).backlinks.map((note) => note.id)).toEqual([notes[0]!.id]);
  });

  test("never rewrites an existing daily note", async () => {
    await setDailyDefault("# {{date}}");
    const daily = await getOrCreateDaily("2026-09-29");
    await updateNote(daily.id, { body: "직접 쓴 내용" });

    const again = await getOrCreateDaily("2026-09-29");

    expect(again.body).toBe("직접 쓴 내용");
  });

  test("keeps notes created before a template existed empty", async () => {
    const before = await getOrCreateDaily("2026-09-28");
    await setDailyDefault("# {{date}}");

    const again = await getOrCreateDaily("2026-09-28");

    expect(again.id).toBe(before.id);
    expect(again.body).toBe("");
  });

  test("creates an empty daily note when no default template exists", async () => {
    const daily = await getOrCreateDaily("2026-09-27");

    expect(daily.body).toBe("");
  });
});
