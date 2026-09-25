import { afterEach, describe, expect, it } from "vitest";
import { HOME_RECENT_NOTES_LIMIT } from "@/domain/home/summary";
import { HOME_TOP3_TARGETS } from "@/lib/home/dto";
import { MAX_LIST_LIMIT } from "@/domain/notes/constants";
import type { NoteRecord } from "@/domain/notes/types";
import { MemoryNotesStore } from "@/server/notes/memory-store";
import { resetNotesRuntimeForTests, setNotesStoreForTests } from "@/server/notes/runtime";
import { handleGetHome } from "./http";

afterEach(() => {
  resetNotesRuntimeForTests();
});

function stamp(store: MemoryNotesStore, id: string, updatedAt: string): void {
  const note = store.notes.get(id);
  if (!note) {
    throw new Error(`missing note ${id}`);
  }
  store.notes.set(id, { ...note, updatedAt });
}

describe("GET /api/home", () => {
  it("returns empty_vault when the vault has no live notes", async () => {
    const store = new MemoryNotesStore();
    setNotesStoreForTests(store);
    const response = await handleGetHome();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      ok: true,
      state: "empty_vault",
      top3: HOME_TOP3_TARGETS,
      inboxBadge: { count: 0 },
    });
    expect(body).not.toHaveProperty("recentNotes");
  });

  it("lists live notes newest first and leaves soft-deleted notes out", async () => {
    const store = new MemoryNotesStore();
    setNotesStoreForTests(store);
    const live = [];
    for (let index = 0; index < HOME_RECENT_NOTES_LIMIT + 2; index += 1) {
      const note = await store.createNote({
        title: `note-${index}`,
        body: `body-${index}`,
        status: index === HOME_RECENT_NOTES_LIMIT + 1 ? "archived" : "draft",
      });
      const updatedAt = new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString();
      stamp(store, note.id, updatedAt);
      live.push({ id: note.id, title: note.title, updatedAt });
    }
    const trash = await store.createNote({ title: "trash", body: "gone", status: "draft" });
    await store.softDeleteNote(trash.id, new Date("2026-12-01T00:00:00.000Z"), new Date("2026-12-08T00:00:00.000Z"));
    stamp(store, trash.id, "2026-12-01T00:00:00.000Z");

    const response = await handleGetHome();
    expect(response.status).toBe(200);
    const expected = [...live]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, HOME_RECENT_NOTES_LIMIT);
    expect(await response.json()).toEqual({
      ok: true,
      state: "ready",
      top3: HOME_TOP3_TARGETS,
      inboxBadge: { count: 0 },
      recentNotes: expected,
    });
    expect(expected[0]?.title).toBe(`note-${HOME_RECENT_NOTES_LIMIT + 1}`);
    expect(expected.some((note) => note.title === "note-0")).toBe(false);
  });

  it("counts every pending inbox row and skips promoted and discarded rows", async () => {
    const store = new MemoryNotesStore();
    setNotesStoreForTests(store);
    await store.createNote({ title: "vault", body: "has notes", status: "draft" });
    for (let index = 0; index < MAX_LIST_LIMIT + 1; index += 1) {
      await store.createInboxItem({
        title: `open-${index}`,
        body: "",
        source: "api",
        url: null,
      });
    }
    const discarded = await store.createInboxItem({
      title: "closed",
      body: "",
      source: "web",
      url: null,
    });
    await store.discardInboxItem(discarded.id, new Date("2026-09-01T00:00:00.000Z"), {
      allowPromoted: false,
    });
    const promoted = await store.createInboxItem({
      title: "promoted",
      body: "becomes a note",
      source: "url",
      url: "https://example.com",
    });
    await store.promoteInboxItem(
      promoted.id,
      { title: "from inbox", body: "becomes a note", status: "draft" },
      { allowDiscarded: false },
    );

    const response = await handleGetHome();
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      ok: true;
      state: string;
      inboxBadge: { count: number };
      recentNotes: { title: string; body?: string }[];
    };
    expect(body.state).toBe("ready");
    expect(body.inboxBadge.count).toBe(MAX_LIST_LIMIT + 1);
    expect(body.recentNotes.some((note) => note.title === "from inbox")).toBe(true);
    expect(body.recentNotes.every((note) => note.body === undefined)).toBe(true);
    expect(body).not.toHaveProperty("preview");
    expect(body).not.toHaveProperty("threads");
  });

  it("returns summary_failed when the notes read throws", async () => {
    class NotesDown extends MemoryNotesStore {
      override async listNotes(): Promise<{ notes: NoteRecord[]; nextCursor: string | null }> {
        throw new Error("notes down");
      }
    }
    const store = new NotesDown();
    await store.createNote({ title: "hidden", body: "secret", status: "draft" });
    await store.createInboxItem({ title: "open", body: "", source: "api", url: null });
    setNotesStoreForTests(store);

    const response = await handleGetHome();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ ok: false, code: "summary_failed" });
  });

  it("returns summary_failed when the inbox read throws and does not invent a badge", async () => {
    class InboxDown extends MemoryNotesStore {
      override async listInboxItems(): Promise<{ items: []; nextCursor: null }> {
        throw new Error("inbox down");
      }
    }
    const store = new InboxDown();
    await store.createNote({ title: "visible-if-bug", body: "secret", status: "draft" });
    setNotesStoreForTests(store);

    const response = await handleGetHome();
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ ok: false, code: "summary_failed" });
    expect(body).not.toHaveProperty("recentNotes");
    expect(body).not.toHaveProperty("inboxBadge");
  });
});
