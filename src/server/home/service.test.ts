import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { query } from "@/server/db";
import { captureInbox, discardInbox } from "@/server/inbox";
import { createNote, getOrCreateDaily, trashNote, updateNote } from "@/server/notes/service";
import { closeDb, connectTestDatabase, resetData } from "@/server/test/db";
import { getHomeData, homeDate } from "./service";

connectTestDatabase();
beforeEach(resetData);
afterAll(closeDb);

describe("home dashboard", () => {
  test("uses the supplied timezone for the daily date", () => {
    const instant = new Date("2026-09-27T15:30:00.000Z");
    expect(homeDate(instant, "UTC")).toBe("2026-09-27");
    expect(homeDate(instant, "Asia/Seoul")).toBe("2026-09-28");
  });

  test("returns open inbox, daily, pinned, recent, stable resurfacing, and active statistics", async () => {
    const daily = await getOrCreateDaily("2026-09-28");
    const target = await createNote({ title: "연결 대상", tags: ["공통"] });
    const old = await createNote({ title: "오래된 생각", body: "[[연결 대상]] 다시 보기", tags: ["기억"] });
    const pinned = await createNote({ title: "고정 노트", tags: ["중요"] });
    await updateNote(pinned.id, { pinned: true });
    const archived = await createNote({ title: "보관 노트", tags: ["보관"] });
    await updateNote(archived.id, { archived: true });
    const trashed = await createNote({ title: "삭제 노트", tags: ["삭제"] });
    await trashNote(trashed.id);
    await query("UPDATE notes SET updated_at='2026-08-01T00:00:00Z' WHERE id=$1", [old.id]);

    const captures = await Promise.all([
      captureInbox({ title: "첫 캡처", text: "하나" }),
      captureInbox({ title: "둘째 캡처", text: "둘" }),
      captureInbox({ title: "셋째 캡처", text: "셋" }),
      captureInbox({ title: "넷째 캡처", text: "넷" }),
      captureInbox({ title: "버릴 캡처", text: "버림" }),
    ]);
    await discardInbox(captures[4]!.id);

    const options = { now: new Date("2026-09-27T15:30:00Z"), timeZone: "Asia/Seoul" };
    const first = await getHomeData(options);
    const second = await getHomeData(options);

    expect(first.inboxCount).toBe(4);
    expect(first.inboxPreview).toHaveLength(3);
    expect(first.daily?.id).toBe(daily.id);
    expect(first.pinned.map((note) => note.id)).toEqual([pinned.id]);
    expect(first.recent.map((note) => note.id)).not.toContain(archived.id);
    expect(first.recent.map((note) => note.id)).not.toContain(trashed.id);
    expect(first.resurface.map((note) => note.id)).toContain(old.id);
    expect(second.resurface.map((note) => note.id)).toEqual(first.resurface.map((note) => note.id));
    expect(first.stats).toEqual({ notes: 5, links: 1, tags: 4 });
    expect(first.recent.map((note) => note.id)).toContain(target.id);
  });
});
