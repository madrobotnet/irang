import { cosineSimilarity } from "@/domain/search/embed";
import { sourceHash, tokenize } from "@/domain/search/text";
import type { SearchFilters, SearchSourceDoc } from "@/domain/search/types";
import type { ScoredDoc, SearchIndex } from "./ports";

type Row = SearchSourceDoc & {
  hash: string;
  embedding: number[] | null;
};

function passesFilters(doc: SearchSourceDoc, filters: SearchFilters): boolean {
  if (filters.status && doc.status !== filters.status) {
    return false;
  }
  const time = new Date(doc.updatedAt).getTime();
  if (filters.from && time < new Date(filters.from).getTime()) {
    return false;
  }
  if (filters.to && time > new Date(filters.to).getTime()) {
    return false;
  }
  return true;
}

/** All query tokens must occur, matching plainto_tsquery AND semantics. Title weighs more. */
export function memoryKeywordScore(query: string, title: string, body: string): number | null {
  const tokens = [...new Set(tokenize(query))];
  if (tokens.length === 0) {
    return null;
  }
  const titleTokens = new Set(tokenize(title));
  const bodyTokens = new Set(tokenize(body));
  let score = 0;
  for (const token of tokens) {
    if (titleTokens.has(token)) {
      score += 2;
    } else if (bodyTokens.has(token)) {
      score += 1;
    } else {
      return null;
    }
  }
  return score;
}

export class MemorySearchIndex implements SearchIndex {
  private rows = new Map<string, Row>();

  async prepare(): Promise<void> {}

  async sync(docs: SearchSourceDoc[]): Promise<void> {
    const seen = new Set<string>();
    for (const doc of docs) {
      seen.add(doc.id);
      const hash = sourceHash(doc.title, doc.body);
      const prev = this.rows.get(doc.id);
      if (!prev || prev.hash !== hash) {
        this.rows.set(doc.id, { ...doc, hash, embedding: null });
      } else {
        this.rows.set(doc.id, { ...doc, hash, embedding: prev.embedding });
      }
    }
    for (const id of this.rows.keys()) {
      if (!seen.has(id)) {
        this.rows.delete(id);
      }
    }
  }

  async keyword(query: string, filters: SearchFilters, limit: number): Promise<ScoredDoc[]> {
    const hits: ScoredDoc[] = [];
    for (const row of this.rows.values()) {
      if (!passesFilters(row, filters)) {
        continue;
      }
      const score = memoryKeywordScore(query, row.title, row.body);
      if (score === null) {
        continue;
      }
      hits.push(toScored(row, score));
    }
    hits.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    return hits.slice(0, limit);
  }

  async semantic(vector: number[], filters: SearchFilters, limit: number): Promise<ScoredDoc[]> {
    const hits: ScoredDoc[] = [];
    for (const row of this.rows.values()) {
      if (!row.embedding || !passesFilters(row, filters)) {
        continue;
      }
      hits.push(toScored(row, cosineSimilarity(vector, row.embedding)));
    }
    hits.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    return hits.slice(0, limit);
  }

  async listPending(limit: number): Promise<SearchSourceDoc[]> {
    return [...this.rows.values()]
      .filter((row) => row.embedding === null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id))
      .slice(0, limit)
      .map(toSource);
  }

  async saveEmbedding(id: string, vector: number[]): Promise<void> {
    const row = this.rows.get(id);
    if (!row) {
      return;
    }
    this.rows.set(id, { ...row, embedding: vector });
  }

  async counts(): Promise<{ pending: number; indexed: number }> {
    let pending = 0;
    let indexed = 0;
    for (const row of this.rows.values()) {
      if (row.embedding) {
        indexed += 1;
      } else {
        pending += 1;
      }
    }
    return { pending, indexed };
  }
}

function toSource(row: Row): SearchSourceDoc {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toScored(row: Row, score: number): ScoredDoc {
  return { ...toSource(row), score };
}
