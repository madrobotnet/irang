export const SEARCH_INDEX_STATUSES = ["ready", "indexing", "keyword_only"] as const;

export type SearchIndexStatus = (typeof SEARCH_INDEX_STATUSES)[number];

export type EmbedCounts = {
  pending: number;
  indexed: number;
};

export function indexStatusFromCounts(counts: EmbedCounts): SearchIndexStatus {
  if (counts.pending <= 0) {
    return "ready";
  }
  if (counts.indexed <= 0) {
    return "keyword_only";
  }
  return "indexing";
}

export function showsKeywordIndexBanner(status: SearchIndexStatus | null | undefined): boolean {
  return status === "indexing" || status === "keyword_only";
}
