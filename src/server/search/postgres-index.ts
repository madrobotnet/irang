import type { Pool } from "pg";
import { E4_DEV_GATES } from "@/domain/search/dev-process-gates";
import { vectorLiteral } from "@/domain/search/embed";
import type { SearchFilters, SearchSourceDoc } from "@/domain/search/types";
import type { ScoredDoc, SearchIndex } from "./ports";

type NoteRow = {
  id: string;
  title: string;
  body: string;
  status: string;
  created_at: Date;
  updated_at: Date;
  score?: number;
};

function toDoc(row: NoteRow, score?: number): ScoredDoc {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    score: score ?? 0,
  };
}

export class PostgresSearchIndex implements SearchIndex {
  constructor(private readonly pool: Pool) {}

  async prepare(): Promise<void> {
    if (E4_DEV_GATES.indexShape !== "columns_on_entity") {
      throw new Error("unsupported index shape");
    }
    if (E4_DEV_GATES.fts !== "simple") {
      throw new Error("unsupported fts config");
    }
    await this.pool.query(
      `UPDATE notes
       SET search_embedding = NULL, search_embedded_at = NULL
       WHERE search_embedding IS NOT NULL
         AND search_source_hash IS DISTINCT FROM md5(coalesce(title, '') || E'\\n' || coalesce(body, ''))`,
    );
  }

  async sync(_docs: SearchSourceDoc[]): Promise<void> {}

  async keyword(query: string, filters: SearchFilters, limit: number): Promise<ScoredDoc[]> {
    const params: unknown[] = [query];
    const filterSql = filterClause(filters, params);
    params.push(limit);
    const { rows } = await this.pool.query<NoteRow>(
      `SELECT id, title, body, status, created_at, updated_at,
              ts_rank(search_tsv, plainto_tsquery('simple', $1)) AS score
       FROM notes
       WHERE deleted_at IS NULL
         AND (purge_at IS NULL OR purge_at > now())
         AND search_tsv @@ plainto_tsquery('simple', $1)
         ${filterSql}
       ORDER BY score DESC, updated_at DESC, id
       LIMIT $${params.length}`,
      params,
    );
    return rows.map((row) => toDoc(row, Number(row.score ?? 0)));
  }

  async semantic(vector: number[], filters: SearchFilters, limit: number): Promise<ScoredDoc[]> {
    const params: unknown[] = [vectorLiteral(vector)];
    const filterSql = filterClause(filters, params);
    params.push(limit);
    const { rows } = await this.pool.query<NoteRow>(
      `SELECT id, title, body, status, created_at, updated_at,
              1 - (search_embedding <=> $1::vector) AS score
       FROM notes
       WHERE deleted_at IS NULL
         AND (purge_at IS NULL OR purge_at > now())
         AND search_embedding IS NOT NULL
         ${filterSql}
       ORDER BY search_embedding <=> $1::vector, id
       LIMIT $${params.length}`,
      params,
    );
    return rows.map((row) => toDoc(row, Number(row.score ?? 0)));
  }

  async listPending(limit: number): Promise<SearchSourceDoc[]> {
    const { rows } = await this.pool.query<NoteRow>(
      `SELECT id, title, body, status, created_at, updated_at
       FROM notes
       WHERE deleted_at IS NULL
         AND (purge_at IS NULL OR purge_at > now())
         AND search_embedding IS NULL
       ORDER BY updated_at DESC, id
       LIMIT $1`,
      [limit],
    );
    return rows.map((row) => toDoc(row));
  }

  async saveEmbedding(id: string, vector: number[]): Promise<void> {
    await this.pool.query(
      `UPDATE notes
       SET search_embedding = $2::vector,
           search_embedded_at = now(),
           search_source_hash = md5(coalesce(title, '') || E'\\n' || coalesce(body, ''))
       WHERE id = $1::uuid
         AND deleted_at IS NULL`,
      [id, vectorLiteral(vector)],
    );
  }

  async counts(): Promise<{ pending: number; indexed: number }> {
    const { rows } = await this.pool.query<{ pending: string; indexed: string }>(
      `SELECT
         count(*) FILTER (WHERE search_embedding IS NULL) AS pending,
         count(*) FILTER (WHERE search_embedding IS NOT NULL) AS indexed
       FROM notes
       WHERE deleted_at IS NULL
         AND (purge_at IS NULL OR purge_at > now())`,
    );
    return {
      pending: Number(rows[0]?.pending ?? 0),
      indexed: Number(rows[0]?.indexed ?? 0),
    };
  }
}

function filterClause(filters: SearchFilters, params: unknown[]): string {
  const parts: string[] = [];
  if (filters.status) {
    params.push(filters.status);
    parts.push(`status = $${params.length}`);
  }
  if (filters.from) {
    params.push(filters.from);
    parts.push(`updated_at >= $${params.length}::timestamptz`);
  }
  if (filters.to) {
    params.push(filters.to);
    parts.push(`updated_at <= $${params.length}::timestamptz`);
  }
  return parts.length ? ` AND ${parts.join(" AND ")}` : "";
}
