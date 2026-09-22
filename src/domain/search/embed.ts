import { E4_DEV_GATES } from "./dev-process-gates";
import { tokenize } from "./text";

export const EMBEDDING_DIM = 128;
export const EMBEDDER_ID = "hashed-ngram-v1";

function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function addFeature(vec: number[], feature: string): void {
  const hash = fnv1a(feature);
  const index = hash % EMBEDDING_DIM;
  vec[index] = (vec[index] ?? 0) + ((hash & 0x10) === 0 ? 1 : -1);
}

function normalize(vec: number[]): number[] {
  let norm = 0;
  for (const value of vec) {
    norm += value * value;
  }
  norm = Math.sqrt(norm);
  if (norm === 0) {
    return vec;
  }
  return vec.map((value) => value / norm);
}

/** Deterministic hashed n-gram vector for pgvector. No second embedding API. */
export function embedText(text: string): number[] {
  if (E4_DEV_GATES.embedder !== "hashed_ngram_pgvector") {
    throw new Error("unsupported embedder");
  }
  const vec = new Array<number>(EMBEDDING_DIM).fill(0);
  for (const token of tokenize(text)) {
    addFeature(vec, token);
    if (token.length < 2) {
      continue;
    }
    for (let i = 0; i < token.length - 1; i++) {
      addFeature(vec, token.slice(i, i + 2));
    }
  }
  return normalize(vec);
}

export function cosineSimilarity(left: number[], right: number[]): number {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  const length = Math.min(left.length, right.length);
  for (let i = 0; i < length; i++) {
    const a = left[i] ?? 0;
    const b = right[i] ?? 0;
    dot += a * b;
    leftNorm += a * a;
    rightNorm += b * b;
  }
  if (leftNorm === 0 || rightNorm === 0) {
    return 0;
  }
  return dot / Math.sqrt(leftNorm * rightNorm);
}

export function vectorLiteral(values: number[]): string {
  return `[${values.map((value) => Number(value).toString()).join(",")}]`;
}
