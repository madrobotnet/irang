import { expect, test } from "bun:test";
import { unstable_serialize } from "swr/infinite";
import { isNoteCollectionKey } from "./note-cache";

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
    "/api/chat/threads",
    "/api/auth/me",
    "/api/notes/id",
  ];

  expect(keys.map(isNoteCollectionKey)).toEqual([true, true, true, true, true, true, true, true, false, false, false]);
});
