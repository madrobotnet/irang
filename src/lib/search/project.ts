import type { EvidenceNotesOk, ScoreJudgmentDto, SearchResultsOk } from "./dto";

export type SearchRow = {
  noteId: string;
  title: string;
  path: string;
  snippet: string | null;
  /** Choice probability for this note. Not ranking confidence, and not a keyword score. */
  probability: number | null;
  /** Score confidence once evidence relevance was asked. */
  relevance: number | null;
  /** Stored similarity Score confidence. */
  similarity: number | null;
  /** Legend text nearest the stored similarity score. Not a new judgment. */
  similarityLabel: string | null;
};

function legendLabel(score: ScoreJudgmentDto): string | null {
  const label = score.legend[String(Math.round(score.score))];
  if (typeof label !== "string") return null;
  const trimmed = label.trim();
  return trimmed ? trimmed : null;
}

function unit(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 0 || value > 1) return null;
  return value;
}

export function notePath(noteId: string): string {
  return `notes/${noteId}`;
}

/** Reads the stored Choice probability. Does not re-rank. */
export function projectRows(
  envelope: SearchResultsOk,
  evidence: EvidenceNotesOk | null,
): SearchRow[] {
  return envelope.results.map((hit) => {
    const judged = evidence?.notes.find((note) => note.noteId === hit.noteId);
    return {
      noteId: hit.noteId,
      title: hit.title,
      path: notePath(hit.noteId),
      snippet: hit.snippet,
      probability: unit(envelope.ranking.probabilities[hit.noteId]),
      relevance: judged?.relevance ? unit(judged.relevance.confidence) : null,
      similarity: judged ? unit(judged.similarity.confidence) : null,
      similarityLabel: judged ? legendLabel(judged.similarity) : null,
    };
  });
}
