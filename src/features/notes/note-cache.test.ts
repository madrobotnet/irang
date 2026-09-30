import { expect, test } from "bun:test";
import { unstable_serialize } from "swr/infinite";
import { isNoteCollectionKey, isScopedToNote, TRASH_COUNT_KEY } from "./note-cache";

test("recognizes note collections and dependent views including SWR Infinite", () => {
  const keys = [
    "/api/notes?limit=30",
    unstable_serialize(() => "/api/notes?limit=30"),
    "/api/notes/id/links",
    "/api/notes/id/related?limit=6",
    "/api/graph?depth=1",
    "/api/home",
    "/api/home?timeZone=Asia%2FSeoul",
    "/api/notes/titles?q=alias",
    TRASH_COUNT_KEY,
    "/api/daily/calendar?month=2026-09",
    "/api/chat/threads",
    "/api/auth/me",
    "/api/notes/id",
  ];

  expect(keys.map(isNoteCollectionKey)).toEqual([true, true, true, true, true, true, true, true, true, true, false, false, false]);
});

test("scopes a removed note's own links, related and focused graph views", () => {
  const id = "123e4567-e89b-42d3-a456-426614174000";
  const scoped = [`/api/notes/${id}/links`, `/api/notes/${id}/related?limit=6`, `/api/graph?depth=1&tags=0&orphans=1&focus=${id}`];
  const other = ["/api/graph?depth=1&tags=0&orphans=1", `/api/graph?depth=1&focus=${id}0`, "/api/notes/other/links", "/api/notes?limit=30"];
  expect(scoped.map((key) => isScopedToNote(key, id))).toEqual([true, true, true]);
  expect(other.map((key) => isScopedToNote(key, id))).toEqual([false, false, false, false]);
});
