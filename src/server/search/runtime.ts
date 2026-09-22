import { loadAuthEnv } from "../auth/runtime";
import { getPool } from "../db/postgres";
import { ensureNotesSchema } from "../notes/schema";
import { MemorySearchIndex } from "./memory-index";
import { PostgresSearchIndex } from "./postgres-index";
import type { SearchIndex } from "./ports";
import { ensureSearchSchema, resetSearchSchemaForTests } from "./schema";

export class SearchIndexUnavailableError extends Error {
  readonly code = "search_index_unavailable" as const;
  constructor(cause?: unknown) {
    super("Search index is unavailable");
    this.name = "SearchIndexUnavailableError";
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

let cached: SearchIndex | null = null;
let override: SearchIndex | null = null;

export function setSearchIndexForTests(next: SearchIndex | null): void {
  override = next;
}

export function resetSearchRuntimeForTests(): void {
  override = null;
  cached = null;
  resetSearchSchemaForTests();
}

export async function getSearchIndex(): Promise<SearchIndex> {
  if (override) {
    return override;
  }
  if (cached) {
    return cached;
  }
  const env = loadAuthEnv();
  if (!env.databaseUrl) {
    cached = new MemorySearchIndex();
    return cached;
  }
  try {
    await ensureNotesSchema(env.databaseUrl);
    await ensureSearchSchema(env.databaseUrl);
  } catch (error) {
    throw new SearchIndexUnavailableError(error);
  }
  cached = new PostgresSearchIndex(getPool(env.databaseUrl));
  return cached;
}
