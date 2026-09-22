import { E4_DEV_GATES } from "@/domain/search/dev-process-gates";
import {
  chatContextLimitSignal,
  type ChatContextLimitDto,
  type ChatNoulJudgmentDto,
  type ChatScoreJudgmentDto,
} from "@/lib/chat/dto";

export type ChatNoteCandidate = {
  noteId: string;
  title: string;
  body: string;
  include: ChatNoulJudgmentDto;
  relevance: ChatScoreJudgmentDto;
};

export type PackedChatNote = {
  noteId: string;
  title: string;
  excerpt: string;
  include: ChatNoulJudgmentDto;
  relevance: ChatScoreJudgmentDto;
};

function upperMass(score: ChatScoreJudgmentDto): number {
  return (score.probabilities["2"] ?? 0) + (score.probabilities["3"] ?? 0);
}

/** Eligible when Jev include or relevance clears the E4 evidence bar. Not a keyword score. */
export function chatNoteEligible(note: ChatNoteCandidate): boolean {
  return (
    note.include.noul >= E4_DEV_GATES.evidenceMin || upperMass(note.relevance) >= E4_DEV_GATES.evidenceMin
  );
}

/** Title plus a body excerpt that fits in `budget` characters. */
export function packNoteText(
  title: string,
  body: string,
  budget: number,
): { title: string; excerpt: string } | null {
  if (budget <= 0) {
    return null;
  }
  if (title.length >= budget) {
    return { title: title.slice(0, budget), excerpt: "" };
  }
  const room = budget - title.length - 1;
  if (room <= 0) {
    return { title: title.slice(0, budget), excerpt: "" };
  }
  return { title, excerpt: body.slice(0, room) };
}

export function packedChars(note: Pick<PackedChatNote, "title" | "excerpt">): number {
  return note.excerpt.length === 0 ? note.title.length : note.title.length + 1 + note.excerpt.length;
}

/**
 * Keep Jev-eligible notes in relevance order, then truncate to the note and
 * character caps. A note that does not clear the Jev bar is left out.
 */
export function selectChatNotes(
  candidates: readonly ChatNoteCandidate[],
  limits: { maxNotes: number; maxChars: number },
): { selected: PackedChatNote[]; contextLimit: ChatContextLimitDto } {
  const ranked = candidates.filter(chatNoteEligible).sort((left, right) => {
    const byScore = right.relevance.score - left.relevance.score;
    if (byScore !== 0) {
      return byScore;
    }
    const byInclude = right.include.noul - left.include.noul;
    if (byInclude !== 0) {
      return byInclude;
    }
    return left.noteId.localeCompare(right.noteId);
  });

  const selected: PackedChatNote[] = [];
  let used = 0;
  for (const note of ranked) {
    if (selected.length >= limits.maxNotes) {
      break;
    }
    const gap = selected.length === 0 ? 0 : 2;
    const packed = packNoteText(note.title, note.body, limits.maxChars - used - gap);
    if (!packed) {
      break;
    }
    const next: PackedChatNote = {
      noteId: note.noteId,
      title: packed.title,
      excerpt: packed.excerpt,
      include: note.include,
      relevance: note.relevance,
    };
    used += gap + packedChars(next);
    selected.push(next);
    if (used >= limits.maxChars) {
      break;
    }
  }

  return {
    selected,
    contextLimit: chatContextLimitSignal(selected.length, used),
  };
}
