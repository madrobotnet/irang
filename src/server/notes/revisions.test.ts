import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { db, query } from "@/server/db";
import { closeDb, connectTestDatabase, resetData } from "@/server/test/db";
import { pruneAgedRevisions, REVISION_LIMIT } from "./revision-store";
import { getRevision, listRevisions, restoreRevision } from "./revisions";
import { createNote, getNoteLinks, purgeNote, trashNote, updateNote } from "./service";

connectTestDatabase();
beforeEach(resetData);
afterAll(closeDb);

const bodies = async (noteId: string): Promise<string[]> =>
  (await query<{ body: string }>(
    "SELECT body FROM note_revisions WHERE note_id=$1 ORDER BY created_at DESC,id DESC", [noteId],
  )).map((row) => row.body);
const ageRevisions = (noteId: string, interval: string) =>
  query(`UPDATE note_revisions SET created_at=created_at - interval '${interval}' WHERE note_id=$1`, [noteId]);

describe("revision snapshots", () => {
  test("the first content edit keeps the previous state and later edits within 10 minutes coalesce", async () => {
    const note = await createNote({ title: "초안", body: "v1" });

    await updateNote(note.id, { body: "v2" });
    await updateNote(note.id, { body: "v3" });

    expect(await bodies(note.id)).toEqual(["v1"]);
  });

  test("an edit after the newest snapshot is 10 minutes old keeps the state it replaces", async () => {
    const note = await createNote({ title: "초안", body: "v1" });
    await updateNote(note.id, { body: "v2" });
    await updateNote(note.id, { body: "v3" });
    await ageRevisions(note.id, "11 minutes");

    await updateNote(note.id, { body: "v4" });

    expect(await bodies(note.id)).toEqual(["v3", "v1"]);
  });

  test("non-edit reasons always snapshot, even right after an edit", async () => {
    const note = await createNote({ title: "할 일", body: "- [ ] a" });
    await updateNote(note.id, { body: "- [ ] a\n- [ ] b" });

    await updateNote(note.id, { body: "- [x] a\n- [ ] b" }, { reason: "task-toggle" });

    const revisions = await listRevisions(note.id);
    expect(revisions.map((revision) => revision.reason)).toEqual(["task-toggle", "edit"]);
    expect(revisions[0]?.bodyLength).toBe("- [ ] a\n- [ ] b".length);
  });

  test("pin and archive changes do not create snapshots", async () => {
    const note = await createNote({ title: "고정", body: "본문" });

    await updateNote(note.id, { pinned: true });
    await updateNote(note.id, { archived: true });

    expect(await bodies(note.id)).toEqual([]);
  });

  test("keeps at most the newest 50 snapshots per note", async () => {
    const note = await createNote({ title: "많은 버전", body: "current" });
    await query(
      `INSERT INTO note_revisions (note_id,title,body,created_at)
       SELECT $1,'많은 버전','old ' || i,now() - i * interval '1 hour' FROM generate_series(1,60) i`,
      [note.id],
    );

    await updateNote(note.id, { body: "next" });

    const kept = await bodies(note.id);
    expect(kept).toHaveLength(REVISION_LIMIT);
    expect(kept[0]).toBe("current");
    expect(kept.at(-1)).toBe("old 49");
  });

  test("drops snapshots older than 30 days but never a note's newest one", async () => {
    const edited = await createNote({ title: "편집됨", body: "current" });
    const idle = await createNote({ title: "방치됨", body: "current" });
    for (const id of [edited.id, idle.id]) {
      await query(
        `INSERT INTO note_revisions (note_id,title,body,created_at)
         SELECT $1,'x','old ' || i,now() - (30 + i) * interval '1 day' FROM generate_series(1,3) i`,
        [id],
      );
    }

    await updateNote(edited.id, { body: "next" });
    await pruneAgedRevisions(await db());

    expect(await bodies(edited.id)).toEqual(["current"]);
    expect(await bodies(idle.id)).toEqual(["old 1"]);
  });
});

describe("revision restore", () => {
  test("restores title and body through the update path, re-linking and keeping the pre-restore state", async () => {
    const target = await createNote({ title: "대상" });
    const note = await createNote({ title: "원래 제목", body: "[[대상]] 참고" });
    await updateNote(note.id, { title: "바뀐 제목", body: "링크 없음" });
    const [original] = await listRevisions(note.id);
    if (!original) throw new Error("Missing revision fixture");

    const restored = await restoreRevision(note.id, original.id);

    expect(restored.title).toBe("원래 제목");
    expect(restored.body).toBe("[[대상]] 참고");
    expect(restored.aliases).toContain("바뀐 제목");
    expect((await getNoteLinks(target.id)).backlinks.map((link) => link.id)).toEqual([note.id]);
    const [undo] = await listRevisions(note.id);
    expect(undo?.reason).toBe("restore");
    expect((await getRevision(note.id, undo!.id)).body).toBe("링크 없음");
  });

  test("a trashed note stays read-only", async () => {
    const note = await createNote({ title: "휴지통", body: "v1" });
    await updateNote(note.id, { body: "v2" });
    const [revision] = await listRevisions(note.id);
    await trashNote(note.id);

    await expect(restoreRevision(note.id, revision!.id)).rejects.toMatchObject({ code: "conflict" });
  });

  test("a revision of another note is not found", async () => {
    const note = await createNote({ title: "하나", body: "v1" });
    const other = await createNote({ title: "둘" });
    await updateNote(note.id, { body: "v2" });
    const [revision] = await listRevisions(note.id);

    await expect(getRevision(other.id, revision!.id)).rejects.toMatchObject({ code: "not_found" });
  });

  test("purging a note removes its history", async () => {
    const note = await createNote({ title: "삭제", body: "v1" });
    await updateNote(note.id, { body: "v2" });
    await trashNote(note.id);

    await purgeNote(note.id);

    expect(await query("SELECT id FROM note_revisions")).toEqual([]);
  });
});
