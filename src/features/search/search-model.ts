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

export type HighlightSegment = { text: string; hit: boolean };

/**
 * Splits `text` into runs that do or do not contain a whitespace-separated query term,
 * case-insensitively. Overlapping or touching matches merge into one run; with no match the
 * whole text is one plain run.
 */
export function highlightSegments(text: string, query: string): HighlightSegment[] {
  const haystack = text.toLocaleLowerCase();
  const terms = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  // Offsets found in the lower-cased copy only line up with `text` when lower-casing keeps its length.
  if (terms.length === 0 || haystack.length !== text.length) return [{ text, hit: false }];

  const ranges: [number, number][] = [];
  for (const term of terms) {
    for (let at = haystack.indexOf(term); at !== -1; at = haystack.indexOf(term, at + 1)) ranges.push([at, at + term.length]);
  }
  if (ranges.length === 0) return [{ text, hit: false }];
  ranges.sort((a, b) => a[0] - b[0]);

  const segments: HighlightSegment[] = [];
  let cursor = 0;
  let [start, end] = ranges[0]!;
  const flush = () => {
    if (start > cursor) segments.push({ text: text.slice(cursor, start), hit: false });
    segments.push({ text: text.slice(start, end), hit: true });
    cursor = end;
  };
  for (const [from, to] of ranges.slice(1)) {
    if (from <= end) end = Math.max(end, to);
    else {
      flush();
      [start, end] = [from, to];
    }
  }
  flush();
  if (cursor < text.length) segments.push({ text: text.slice(cursor), hit: false });
  return segments;
}
