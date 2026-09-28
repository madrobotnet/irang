import type { SearchHit } from "@/lib/types";

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

export function matchLabel(hit: SearchHit): string[] {
  return hit.matchedBy.map((match) => match === "semantic" ? "문자 유사도" : match === "fuzzy" ? "오타 유사도" : "키워드");
}
