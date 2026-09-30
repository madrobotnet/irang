import { unstable_serialize } from "swr/infinite";
import type { useSWRConfig } from "swr";

const infiniteListPrefix = unstable_serialize(() => "/api/notes?");

/** Unfiltered trash size for the empty-trash action; not a list page, so it is revalidated, never cleared. */
export const TRASH_COUNT_KEY = "notes:trash-count";

/** Includes SWR Infinite's aggregate key as well as its individual page keys. */
export function isNoteCollectionKey(key: unknown): boolean {
  return typeof key === "string" && (
    key.startsWith("/api/notes?") || key.startsWith(infiniteListPrefix)
    || key === TRASH_COUNT_KEY
    || key.startsWith("/api/notes/titles?")
    || key === "/api/tags" || key === "/api/home" || key.startsWith("/api/home?")
    || key.startsWith("/api/graph?") || key.startsWith("/api/search?")
    || key.startsWith("/api/daily/calendar?")
    || /^\/api\/notes\/[^/]+\/(?:links|related)(?:\?|$)/.test(key)
  );
}

/** Views centered on one note, which 404 once that note leaves (trash or purge). */
export function isScopedToNote(key: string, noteId: string): boolean {
  if (key.startsWith(`/api/notes/${noteId}/`)) return true;
  return key.startsWith("/api/graph?") && new URLSearchParams(key.slice("/api/graph?".length)).get("focus") === noteId;
}

/** `removedId`: a note that was just trashed or purged; its own views are cleared instead of refetched. */
export async function refreshNoteViews(
  { cache, mutate }: Pick<ReturnType<typeof useSWRConfig>, "cache" | "mutate">,
  { removedId }: { removedId?: string } = {},
): Promise<void> {
  const keys = [...cache.keys()].filter(isNoteCollectionKey);
  const pages = keys.filter((key) => key.startsWith("/api/notes?") || (removedId !== undefined && isScopedToNote(key, removedId)));
  await Promise.all(pages.map((key) => mutate(key, undefined, { revalidate: false })));
  // Predicate mutation skips SWR's special infinite keys. Address them directly;
  // cleared page data makes the aggregate fetch fresh cursors for every page.
  await Promise.all(keys.filter((key) => !pages.includes(key)).map((key) => mutate(key)));
}
