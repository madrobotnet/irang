import { afterEach, describe, expect, test } from "bun:test";
import type { Note } from "@/lib/types";
import { NoteDraftController, type EditableNote } from "./note-draft";
import { forgetNoteDraft, getNoteDraft, hasUnsavedNoteDrafts } from "./draft-store";

const note = (body = "old"): Note => ({
  id: "00000000-0000-4000-8000-000000000001",
  title: "제목",
  body,
  tags: [],
  aliases: [],
  excerpt: body,
  pinned: false,
  archived: false,
  dailyDate: null,
  sourceUrl: null,
  deletedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

afterEach(() => forgetNoteDraft(note().id));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe("NoteDraftController", () => {
  test("retains an unsaved draft when the same note is reopened", () => {
    const first = getNoteDraft(note(), async () => note());
    first.update({ body: "local draft" });

    const reopened = getNoteDraft(note("stale server text"), async () => note());

    expect(reopened).toBe(first);
    expect(reopened.getSnapshot().body).toBe("local draft");
    expect(hasUnsavedNoteDrafts()).toBe(true);
  });

  test("clears the unload warning condition after a successful flush", async () => {
    const controller = getNoteDraft(note(), async (_id, value) => note(value.body));
    controller.update({ body: "saved text" });

    await controller.flush();

    expect(hasUnsavedNoteDrafts()).toBe(false);
  });

  test("adopts canonical metadata returned by a successful save", async () => {
    const controller = new NoteDraftController(note(), async () => ({
      ...note("#inline"),
      title: "새 제목",
      tags: ["inline"],
      aliases: ["이전 제목"],
      updatedAt: "2026-01-02T00:00:00.000Z",
    }));
    controller.update({ title: " 새 제목 ", body: "#inline" });

    const saved = await controller.flush();

    expect(controller.getSnapshot()).toMatchObject({
      title: "새 제목", tags: ["inline"], aliases: ["이전 제목"], state: "saved",
    });
    expect(saved).toBe(true);
  });

  test("reports a failed flush so destructive actions can stop", async () => {
    const controller = new NoteDraftController(note(), async () => { throw new Error("offline"); });
    controller.update({ body: "retained draft" });

    const saved = await controller.flush();

    expect(saved).toBe(false);
    expect(controller.getSnapshot()).toMatchObject({ body: "retained draft", state: "failed" });
  });

  test("keeps server-added aliases when a newer body edit is queued", async () => {
    const first = Promise.withResolvers<Note>();
    const writes: EditableNote[] = [];
    const controller = new NoteDraftController(note(), async (_id, value) => {
      writes.push(value);
      return writes.length === 1 ? first.promise : { ...note(value.body), ...value };
    });
    controller.update({ title: "renamed" });
    const saving = controller.flush();
    controller.update({ body: "newer body" });

    first.resolve({ ...note(), title: "renamed", aliases: ["제목"] });
    await saving;

    expect(writes[1]).toMatchObject({ body: "newer body", aliases: ["제목"] });
  });

  test("serializes writes and saves edits made while the first write is pending", async () => {
    const first = deferred<Note>();
    const second = deferred<Note>();
    const secondStarted = deferred<void>();
    const writes: EditableNote[] = [];
    const controller = new NoteDraftController(note(), async (_id, value) => {
      writes.push(value);
      if (writes.length === 2) secondStarted.resolve();
      return writes.length === 1 ? first.promise : second.promise;
    });

    controller.update({ body: "first" });
    const saving = controller.flush();
    expect(writes.map((write) => write.body)).toEqual(["first"]);

    controller.update({ body: "latest" });
    first.resolve({ ...note("first"), updatedAt: "2026-01-02T00:00:00.000Z" });
    await secondStarted.promise;
    expect(writes.map((write) => write.body)).toEqual(["first", "latest"]);

    second.resolve({ ...note("latest"), updatedAt: "2026-01-03T00:00:00.000Z" });
    await saving;
    expect(controller.getSnapshot()).toMatchObject({ body: "latest", state: "saved", updatedAt: "2026-01-03T00:00:00.000Z" });
  });

  test("does not hydrate over a dirty draft and retries the retained value", async () => {
    let fail = true;
    const writes: string[] = [];
    const controller = new NoteDraftController(note(), async (_id, value) => {
      writes.push(value.body);
      if (fail) throw new Error("offline");
      return { ...note(value.body), updatedAt: "2026-01-04T00:00:00.000Z" };
    });
    controller.update({ body: "local" });
    controller.hydrate({ ...note("stale"), updatedAt: "2026-01-02T00:00:00.000Z" });
    await controller.flush();
    expect(controller.getSnapshot()).toMatchObject({ body: "local", state: "failed", error: "offline" });

    fail = false;
    await controller.retry();
    expect(writes).toEqual(["local", "local"]);
    expect(controller.getSnapshot()).toMatchObject({ body: "local", state: "saved" });

    controller.hydrate({ ...note("older server body"), updatedAt: "2026-01-03T00:00:00.000Z" });
    expect(controller.getSnapshot().body).toBe("local");
  });
});
