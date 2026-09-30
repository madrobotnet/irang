import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { query, queryOne } from "@/server/db";
import { getHomeData } from "@/server/home";
import { setJevForTests } from "@/server/jev/client";
import { listRevisions } from "@/server/notes/revisions";
import { createNote, getNote, trashNote } from "@/server/notes/service";
import { closeDb, connectTestDatabase, resetData } from "@/server/test/db";
import { captureInbox, discardInbox, listInbox, promoteInbox } from "./service";
import { mergeInbox, restoreInbox, snoozeInbox, unsnoozeInbox } from "./triage";

connectTestDatabase();
beforeEach(async () => {
  setJevForTests(undefined);
  await resetData();
});
afterAll(async () => {
  setJevForTests(undefined);
  await closeDb();
});

const tomorrow = (): Date => new Date(Date.now() + 24 * 60 * 60 * 1000);
const openIds = async (): Promise<string[]> => (await listInbox()).items.map((item) => item.id);

describe("snooze", () => {
  test("hides a snoozed item from the open view, home, and counts it in the later view", async () => {
    const snoozed = await captureInbox({ text: "나중에" });
    const open = await captureInbox({ text: "지금" });
    expect(await listInbox()).toMatchObject({ snoozedCount: 0, nextReturnAt: null });

    const item = await snoozeInbox(snoozed.id, tomorrow());

    expect(item.snoozedUntil).not.toBeNull();
    expect(await listInbox()).toMatchObject({ count: 1, snoozedCount: 1, nextReturnAt: item.snoozedUntil });
    expect(await listInbox("later")).toMatchObject({ nextReturnAt: item.snoozedUntil });
    expect(await openIds()).toEqual([open.id]);
    const later = await listInbox("later");
    expect(later.items.map((entry) => entry.id)).toEqual([snoozed.id]);
    expect(later.count).toBe(1);
    const home = await getHomeData();
    expect(home.inboxCount).toBe(1);
    expect(home.inboxPreview.map((entry) => entry.id)).toEqual([open.id]);
  });

  test("an item returns to the open view once its snooze time passes", async () => {
    const item = await captureInbox({ text: "돌아옴" });
    await snoozeInbox(item.id, tomorrow());

    await query("UPDATE inbox_items SET snoozed_until=now() - interval '1 minute' WHERE id=$1", [item.id]);

    expect(await openIds()).toEqual([item.id]);
    expect((await listInbox("later")).items).toEqual([]);
  });

  test("unsnooze returns the item immediately", async () => {
    const item = await captureInbox({ text: "취소" });
    await snoozeInbox(item.id, tomorrow());

    const restored = await unsnoozeInbox(item.id);

    expect(restored.snoozedUntil).toBeNull();
    expect(await openIds()).toEqual([item.id]);
  });

  const now = new Date("2026-09-30T00:00:00.000Z");
  test.each([
    ["just past", "2026-09-29T23:59:59.000Z"],
    ["more than a year ahead", "2027-09-30T00:00:01.000Z"],
  ])("rejects a time that is %s", async (_label, until) => {
    const item = await captureInbox({ text: "시간" });

    await expect(snoozeInbox(item.id, new Date(until), now)).rejects.toMatchObject({ code: "validation" });
  });

  test("accepts exactly one year ahead", async () => {
    const item = await captureInbox({ text: "시간" });

    const snoozed = await snoozeInbox(item.id, new Date("2027-09-30T00:00:00.000Z"), now);

    expect(snoozed.snoozedUntil).toBe("2027-09-30T00:00:00.000Z");
  });

  test("refuses to snooze a discarded item", async () => {
    const item = await captureInbox({ text: "버림" });
    await discardInbox(item.id);

    await expect(snoozeInbox(item.id, tomorrow())).rejects.toMatchObject({ code: "conflict" });
  });
});

describe("restore", () => {
  test("brings a discarded item back to the open inbox", async () => {
    const item = await captureInbox({ text: "실수로 버림" });
    await discardInbox(item.id);

    await restoreInbox(item.id);

    expect(await openIds()).toEqual([item.id]);
  });

  test("refuses to reopen a promoted item", async () => {
    const item = await captureInbox({ text: "노트가 됨" });
    await promoteInbox(item.id);

    await expect(restoreInbox(item.id)).rejects.toMatchObject({ code: "conflict" });
  });
});

describe("merge into an existing note", () => {
  async function fixture() {
    const note = await createNote({ title: "독서 메모", body: "기존 내용\n" });
    const item = await captureInbox({ title: "인용", text: "새 인용문" });
    await query("UPDATE inbox_items SET url='https://example.com/a' WHERE id=$1", [item.id]);
    await query(
      `INSERT INTO attachments (inbox_item_id,filename,mime,size_bytes,storage_key)
       VALUES ($1,'clip.txt','text/plain',4,'00000000-0000-4000-8000-000000000001')`,
      [item.id],
    );
    return { note, item };
  }
  const attachmentOwner = () => queryOne<{ note_id: string | null; inbox_item_id: string | null }>(
    "SELECT note_id,inbox_item_id FROM attachments LIMIT 1",
  );

  test("appends the item, moves its attachments, and closes it", async () => {
    const { note, item } = await fixture();

    const merged = await mergeInbox(item.id, { noteId: note.id, expectedUpdatedAt: note.updatedAt });

    expect(merged.body).toBe("기존 내용\n\n---\n\n새 인용문\n\nhttps://example.com/a");
    expect(await attachmentOwner()).toEqual({ note_id: note.id, inbox_item_id: null });
    expect(await openIds()).toEqual([]);
    expect((await listRevisions(note.id)).map((revision) => revision.reason)).toEqual(["merge"]);
  });

  test("rejects a stale target without touching the note or the item", async () => {
    const { note, item } = await fixture();

    await expect(mergeInbox(item.id, { noteId: note.id, expectedUpdatedAt: "2020-01-01T00:00:00.000Z" }))
      .rejects.toMatchObject({ code: "conflict", extra: { conflict: "stale" } });

    expect((await getNote(note.id))?.body).toBe("기존 내용\n");
    expect(await attachmentOwner()).toEqual({ note_id: null, inbox_item_id: item.id });
    expect(await openIds()).toEqual([item.id]);
  });

  test("rejects a trashed target", async () => {
    const { note, item } = await fixture();
    await trashNote(note.id);

    await expect(mergeInbox(item.id, { noteId: note.id })).rejects.toMatchObject({ code: "conflict" });

    expect(await openIds()).toEqual([item.id]);
  });

  test("rolls back the appended body when closing the item fails", async () => {
    const { note, item } = await fixture();
    const trigger = `merge_rollback_${crypto.randomUUID().replaceAll("-", "")}`;
    await query(`CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'fixture close failure'; END $$`);
    try {
      await query(`CREATE TRIGGER ${trigger} BEFORE UPDATE OF promoted_note_id ON inbox_items
        FOR EACH ROW EXECUTE FUNCTION ${trigger}()`);

      await expect(mergeInbox(item.id, { noteId: note.id })).rejects.toMatchObject({ code: "P0001" });

      expect((await getNote(note.id))?.body).toBe("기존 내용\n");
      expect(await attachmentOwner()).toEqual({ note_id: null, inbox_item_id: item.id });
      expect(await listRevisions(note.id)).toEqual([]);
    } finally {
      await query(`DROP TRIGGER IF EXISTS ${trigger} ON inbox_items`);
      await query(`DROP FUNCTION ${trigger}()`);
    }
  });

  test("a missing note is not found", async () => {
    const item = await captureInbox({ text: "고아" });

    await expect(mergeInbox(item.id, { noteId: crypto.randomUUID() })).rejects.toMatchObject({ code: "not_found" });
  });
});
