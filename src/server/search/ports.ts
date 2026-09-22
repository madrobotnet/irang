import type { SearchFilters, SearchSourceDoc } from "@/domain/search/types";

export type ScoredDoc = SearchSourceDoc & {
  score: number;
};

export interface SearchIndex {
  prepare(): Promise<void>;
  /** Memory index replaces its corpus. Postgres columns are already the corpus. */
  sync(docs: SearchSourceDoc[]): Promise<void>;
  keyword(query: string, filters: SearchFilters, limit: number): Promise<ScoredDoc[]>;
  semantic(vector: number[], filters: SearchFilters, limit: number): Promise<ScoredDoc[]>;
  listPending(limit: number): Promise<SearchSourceDoc[]>;
  saveEmbedding(id: string, vector: number[]): Promise<void>;
  counts(): Promise<{ pending: number; indexed: number }>;
}
