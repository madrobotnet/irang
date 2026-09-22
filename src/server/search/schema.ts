import { getPool } from "../db/postgres";
import { EMBEDDING_DIM } from "@/domain/search/embed";

const SEARCH_SCHEMA_SQL = `
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE notes ADD COLUMN IF NOT EXISTS search_embedding vector(${EMBEDDING_DIM});
ALTER TABLE notes ADD COLUMN IF NOT EXISTS search_embedded_at timestamptz;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS search_source_hash text;

ALTER TABLE notes ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A')
    || setweight(to_tsvector('simple', coalesce(body, '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS notes_search_tsv_gin ON notes USING gin (search_tsv);
CREATE INDEX IF NOT EXISTS notes_search_embed_hnsw
  ON notes USING hnsw (search_embedding vector_cosine_ops);
`;

let searchSchemaReady: Promise<void> | null = null;

export async function ensureSearchSchema(databaseUrl: string): Promise<void> {
  if (!searchSchemaReady) {
    const pending = (async () => {
      const pool = getPool(databaseUrl);
      await pool.query(SEARCH_SCHEMA_SQL);
    })();
    searchSchemaReady = pending;
    try {
      await pending;
    } catch (error) {
      searchSchemaReady = null;
      throw error;
    }
    return;
  }
  await searchSchemaReady;
}

export function resetSearchSchemaForTests(): void {
  searchSchemaReady = null;
}
