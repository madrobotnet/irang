import { query } from "@/server/db";
import { EmbeddingUnavailable, learnedEmbeddings, queryInput, semanticConfigured, SEMANTIC_MODEL_ID } from "./learned";

export type PassageCandidate = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  updated_at: Date | string;
  rank_score: number | string;
  heading: string;
  start_line: number;
  end_line: number;
  source_hash: string;
};

export type SemanticStatus = {
  state: "disabled" | "unavailable" | "indexing" | "ready";
  indexedNotes: number;
  totalNotes: number;
};

export async function indexStatus(available: boolean): Promise<SemanticStatus> {
  const rows = await query<{ total: string; indexed: string }>(
    `SELECT count(*)::text AS total,
      count(*) FILTER(WHERE i.complete AND i.source_hash=md5(n.title || E'\\n' || n.body))::text AS indexed
     FROM notes n LEFT JOIN note_semantic_index i ON i.note_id=n.id AND i.model_id=$1
     WHERE n.deleted_at IS NULL AND n.status<>'archived'`,
    [SEMANTIC_MODEL_ID],
  );
  const totalNotes = Number(rows[0]?.total ?? 0);
  const indexedNotes = Number(rows[0]?.indexed ?? 0);
  return {
    state: !semanticConfigured() ? "disabled" : !available ? "unavailable" : indexedNotes < totalNotes ? "indexing" : "ready",
    indexedNotes, totalNotes,
  };
}

export async function retrievePassages(text: string, tag: string | undefined, limit: number): Promise<{
  rows: PassageCandidate[];
  available: boolean;
}> {
  if (!semanticConfigured()) return { rows: [], available: false };
  try {
    const [vector] = await learnedEmbeddings([queryInput(text)], 1500);
    if (!vector) throw new EmbeddingUnavailable();
    const rows = await query<PassageCandidate>(
      `SELECT DISTINCT ON (id) * FROM (
         SELECT n.id::text, n.title, p.content AS body, n.tags, n.updated_at,
           1-(p.embedding <=> $1::vector) AS rank_score,
           p.heading,p.start_line,p.end_line,p.source_hash
         FROM note_passages p JOIN notes n ON n.id=p.note_id
         WHERE p.model_id=$2 AND p.source_hash=md5(n.title || E'\\n' || n.body)
           AND n.deleted_at IS NULL AND n.status<>'archived'
           AND ($3::text IS NULL OR EXISTS(SELECT 1 FROM unnest(n.tags) t WHERE lower(t)=$3))
         ORDER BY p.embedding <=> $1::vector,n.id,p.ordinal LIMIT $4
       ) ranked ORDER BY id,rank_score DESC,start_line`,
      [JSON.stringify(vector), SEMANTIC_MODEL_ID, tag ?? null, limit * 4],
    );
    rows.sort((a, b) => Number(b.rank_score) - Number(a.rank_score) || a.id.localeCompare(b.id));
    return { rows: rows.slice(0, limit), available: true };
  } catch (error) {
    if (error instanceof EmbeddingUnavailable) return { rows: [], available: false };
    throw error;
  }
}

/** Related discovery compares fresh document passages in the same learned space. */
export async function relatedPassages(noteId: string, limit: number): Promise<PassageCandidate[]> {
  if (!semanticConfigured()) return [];
  const rows = await query<PassageCandidate>(
    `WITH source AS (
       SELECT p.embedding FROM note_passages p JOIN notes n ON n.id=p.note_id
       WHERE n.id=$1 AND p.model_id=$2 AND n.deleted_at IS NULL AND n.status<>'archived'
         AND p.source_hash=md5(n.title || E'\\n' || n.body)
     ), ranked AS (
       SELECT DISTINCT ON (n.id) n.id::text,n.title,p.content AS body,n.tags,n.updated_at,
         1-(p.embedding <=> s.embedding) AS rank_score,
         p.heading,p.start_line,p.end_line,p.source_hash
       FROM source s CROSS JOIN note_passages p JOIN notes n ON n.id=p.note_id
       WHERE n.id<>$1 AND p.model_id=$2 AND n.deleted_at IS NULL AND n.status<>'archived'
         AND p.source_hash=md5(n.title || E'\\n' || n.body)
       ORDER BY n.id,p.embedding <=> s.embedding,p.ordinal
     )
     SELECT * FROM ranked ORDER BY rank_score DESC,id LIMIT $3`,
    [noteId, SEMANTIC_MODEL_ID, limit],
  );
  return rows;
}
