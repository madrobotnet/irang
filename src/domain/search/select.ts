import { E4_DEV_GATES, EVIDENCE_CAP } from "./dev-process-gates";
import type { EvidenceJudgedNote, ScoreJudgment } from "./types";

function upperMass(score: ScoreJudgment): number {
  return (score.probabilities["2"] ?? 0) + (score.probabilities["3"] ?? 0);
}

/** Keep judged notes that clear the recorded 0.55 bar. Input order is preserved. */
export function selectEvidenceNotes(notes: readonly EvidenceJudgedNote[]): EvidenceJudgedNote[] {
  if (E4_DEV_GATES.evidenceShape !== "noul_plus_relevance_score") {
    return [];
  }
  const selected = notes.filter(
    (note) =>
      note.answers.noul >= E4_DEV_GATES.evidenceMin ||
      upperMass(note.relevance) >= E4_DEV_GATES.evidenceMin ||
      (E4_DEV_GATES.similarity === "score_rubric" && upperMass(note.similarity) >= E4_DEV_GATES.evidenceMin),
  );
  return selected.slice(0, EVIDENCE_CAP);
}
