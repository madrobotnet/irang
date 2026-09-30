import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { closeDb, connectTestDatabase, resetData } from "@/server/test/db";
import { linkMention } from "./mentions";
import { listRevisions } from "./revisions";
import { createNote, getNote, getNoteLinks, trashNote } from "./service";

connectTestDatabase();
beforeEach(resetData);
afterAll(closeDb);

describe("linking an unlinked mention", () => {
  test("wraps the first mention in the source, turning it into a backlink", async () => {
    const target = await createNote({ title: "바질" });
    const source = await createNote({ title: "텃밭 일지", body: "오늘 바질은 잘 자랐다. 바질 향" });
    expect((await getNoteLinks(target.id)).unlinkedMentions.map((note) => note.id)).toEqual([source.id]);

    const linked = await linkMention({ targetId: target.id, sourceId: source.id, expectedUpdatedAt: source.updatedAt });

    expect(linked.body).toBe("오늘 [[바질]]은 잘 자랐다. 바질 향");
    const links = await getNoteLinks(target.id);
    expect(links.backlinks.map((note) => note.id)).toEqual([source.id]);
    expect(links.unlinkedMentions).toEqual([]);
    expect((await listRevisions(source.id)).map((revision) => revision.reason)).toEqual(["link-mention"]);
  });

  test("rejects a stale source without changing it", async () => {
    const target = await createNote({ title: "바질" });
    const source = await createNote({ title: "텃밭 일지", body: "바질 심기" });

    await expect(linkMention({
      targetId: target.id, sourceId: source.id, expectedUpdatedAt: "2020-01-01T00:00:00.000Z",
    })).rejects.toMatchObject({ code: "conflict", extra: { conflict: "stale" } });

    expect((await getNote(source.id))?.body).toBe("바질 심기");
  });

  test("reports a conflict when no linkable mention remains", async () => {
    const target = await createNote({ title: "바질" });
    const source = await createNote({ title: "코드", body: "`바질` 변수와 [[바질]]" });

    await expect(linkMention({ targetId: target.id, sourceId: source.id, expectedUpdatedAt: source.updatedAt }))
      .rejects.toMatchObject({ code: "conflict", extra: { conflict: "mention_gone" } });
  });

  test("refuses a source in the trash", async () => {
    const target = await createNote({ title: "바질" });
    const source = await createNote({ title: "텃밭 일지", body: "바질 심기" });
    const trashed = await trashNote(source.id);

    await expect(linkMention({ targetId: target.id, sourceId: source.id, expectedUpdatedAt: trashed.updatedAt }))
      .rejects.toMatchObject({ code: "conflict" });
  });

  test("refuses a target in the trash", async () => {
    const target = await createNote({ title: "바질" });
    const source = await createNote({ title: "메모", body: "바질 향" });
    await trashNote(target.id);

    await expect(linkMention({ targetId: target.id, sourceId: source.id, expectedUpdatedAt: source.updatedAt }))
      .rejects.toMatchObject({ code: "conflict" });

    expect((await getNote(source.id))?.body).toBe("바질 향");
  });

  test("refuses to link a note to itself", async () => {
    const note = await createNote({ title: "바질", body: "바질 향" });

    await expect(linkMention({ targetId: note.id, sourceId: note.id, expectedUpdatedAt: note.updatedAt }))
      .rejects.toMatchObject({ code: "validation" });
  });
});
