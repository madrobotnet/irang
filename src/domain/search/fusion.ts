import { RETRIEVAL_WEIGHTS } from "./dev-process-gates";

export const RRF_K = 60;

export type FusionRow = {
  id: string;
  score: number;
  keywordRank: number | null;
  semanticRank: number | null;
};

/**
 * Reciprocal rank fusion. A keyword-only row (no embedding yet) stays in the list.
 * Weights stay equal: the routing Choice was below the confidence floor.
 */
export function reciprocalRankFusion(
  keywordIds: readonly string[],
  semanticIds: readonly string[],
  weights: { keyword: number; semantic: number } = RETRIEVAL_WEIGHTS,
): FusionRow[] {
  const keywordRank = new Map(keywordIds.map((id, index) => [id, index + 1]));
  const semanticRank = new Map(semanticIds.map((id, index) => [id, index + 1]));
  const ids = new Set<string>([...keywordIds, ...semanticIds]);
  const rows: FusionRow[] = [];
  for (const id of ids) {
    const kw = keywordRank.get(id) ?? null;
    const sem = semanticRank.get(id) ?? null;
    let score = 0;
    if (kw !== null) {
      score += weights.keyword / (RRF_K + kw);
    }
    if (sem !== null) {
      score += weights.semantic / (RRF_K + sem);
    }
    rows.push({ id, score, keywordRank: kw, semanticRank: sem });
  }
  rows.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return rows;
}
