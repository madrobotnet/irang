import { unstable_serialize } from "swr/infinite";
import type { useSWRConfig } from "swr";

const infiniteListPrefix = unstable_serialize(() => "/api/notes?");

/** Includes SWR Infinite's aggregate key as well as its individual page keys. */
export function isNoteCollectionKey(key: unknown): boolean {
  return typeof key === "string" && (
    key.startsWith("/api/notes?") || key.startsWith(infiniteListPrefix)
    || key.startsWith("/api/notes/titles?")
    || key === "/api/tags" || key === "/api/home" || key.startsWith("/api/home?")
    || key.startsWith("/api/graph?") || key.startsWith("/api/search?")
    || /^\/api\/notes\/[^/]+\/(?:links|related)(?:\?|$)/.test(key)
  );
}

export async function refreshNoteViews({ cache, mutate }: Pick<ReturnType<typeof useSWRConfig>, "cache" | "mutate">): Promise<void> {
  const keys = [...cache.keys()].filter(isNoteCollectionKey);
  const pages = keys.filter((key) => key.startsWith("/api/notes?"));
  await Promise.all(pages.map((key) => mutate(key, undefined, { revalidate: false })));
  // Predicate mutation skips SWR's special infinite keys. Address them directly;
  // cleared page data makes the aggregate fetch fresh cursors for every page.
  await Promise.all(keys.filter((key) => !pages.includes(key)).map((key) => mutate(key)));
}
