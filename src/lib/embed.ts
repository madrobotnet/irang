/**
 * Deterministic hashed character n-gram embedding (128-d) for pgvector.
 * No external embedding API: character similarity, not semantic understanding,
 * used for related notes and as one signal in hybrid search.
 */
export const EMBEDDING_DIM = 128;

function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function tokenize(text: string): string[] {
  return text.toLowerCase().normalize("NFKC").split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

function add(vec: Float64Array, feature: string, weight: number): void {
  const h = fnv1a(feature);
  vec[h % EMBEDDING_DIM]! += (h & 0x10) === 0 ? weight : -weight;
}

export function embedText(text: string): number[] {
  const vec = new Float64Array(EMBEDDING_DIM);
  for (const token of tokenize(text)) {
    add(vec, `w:${token}`, 1);
    const padded = ` ${token} `;
    for (let i = 0; i < padded.length - 2; i++) add(vec, padded.slice(i, i + 3), 0.5);
    for (let i = 0; i < token.length - 1; i++) add(vec, token.slice(i, i + 2), 0.35);
  }
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return Array.from(vec, (v) => v / norm);
}

export function vectorLiteral(values: readonly number[]): string {
  return `[${values.map((v) => (Number.isFinite(v) ? v.toFixed(6) : "0")).join(",")}]`;
}
