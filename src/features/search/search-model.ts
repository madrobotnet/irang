import type { Locale } from "@/lib/i18n/locale";
import type { SearchHit, SearchMatch } from "@/lib/types";
import { SEARCH_COPY } from "./search-copy";

export function searchUrl(query: string, tag: string): string {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  if (tag) params.set("tag", tag);
  return params.size ? `/search?${params}` : "/search";
}

export function searchApiUrl(query: string, tag: string): string | null {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const params = new URLSearchParams({ q: trimmed });
  if (tag) params.set("tag", tag);
  return `/api/search?${params}`;
}

/**
 * Catalog key for each server retrieval signal. "semantic" is the server's internal name for
 * hashed character n-gram similarity, so it is shown as character similarity, never as meaning.
 */
export const MATCH_SIGNAL_COPY = {
  keyword: "keyword",
  fuzzy: "similarSpelling",
  semantic: "characterSimilarity",
} as const satisfies Record<SearchMatch, keyof (typeof SEARCH_COPY)["ko"]["signals"]>;

export function matchLabel(hit: Pick<SearchHit, "matchedBy">, locale: Locale): string[] {
  const signals = SEARCH_COPY[locale].signals;
  return hit.matchedBy.map((match) => signals[MATCH_SIGNAL_COPY[match]]);
}
