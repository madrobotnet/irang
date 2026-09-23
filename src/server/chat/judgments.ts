import { choice, noul, score } from "@typesafe-ai/sdk";
import type { ChatNoteCandidate } from "@/domain/chat/select";
import { CHAT_ROUTE_IDS, type ChatRouteId, type ChatRouteJudgmentDto } from "@/lib/chat/dto";
import { JudgmentFailedError, TypesafeMisconfiguredError, getSystemOneInvoker } from "../typesafe/runtime";

const RELEVANCE_LEVELS = [
  "Does not help answer or edit for the question.",
  "Mentions the topic but is weak context.",
  "Useful context for the question.",
  "Directly answers the question or is the note to edit.",
] as const;

export type ChatJudgedContext = {
  route: ChatRouteJudgmentDto;
  candidates: ChatNoteCandidate[];
};

type NoteInput = {
  id: string;
  title: string;
  body: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as Record<string, unknown>;
}

function readRoute(value: unknown): ChatRouteJudgmentDto {
  const row = asRecord(value);
  if (!row || row.type !== "choice" || typeof row.choice !== "string") {
    throw new Error("route_missing");
  }
  if (!CHAT_ROUTE_IDS.includes(row.choice as ChatRouteId)) {
    throw new Error("route_invalid");
  }
  const raw = asRecord(row.probabilities);
  if (!raw || typeof row.confidence !== "number") {
    throw new Error("route_incomplete");
  }
  const probabilities = {} as ChatRouteJudgmentDto["probabilities"];
  for (const id of CHAT_ROUTE_IDS) {
    const probability = raw[id];
    if (typeof probability !== "number") {
      throw new Error("route_incomplete");
    }
    probabilities[id] = probability;
  }
  return {
    type: "choice",
    choice: row.choice as ChatRouteId,
    confidence: row.confidence,
    probabilities,
  };
}

function readNoul(value: unknown): ChatNoteCandidate["include"] {
  const row = asRecord(value);
  if (!row || row.type !== "noul" || typeof row.noul !== "number" || row.noul < 0 || row.noul > 1) {
    throw new Error("include_missing");
  }
  return { type: "noul", noul: row.noul };
}

function readScore(value: unknown): ChatNoteCandidate["relevance"] {
  const row = asRecord(value);
  if (!row || row.type !== "score" || typeof row.score !== "number" || typeof row.confidence !== "number") {
    throw new Error("relevance_missing");
  }
  const rawProbs = asRecord(row.probabilities);
  const rawLegend = asRecord(row.legend);
  if (!rawProbs || !rawLegend) {
    throw new Error("relevance_incomplete");
  }
  const probabilities: Record<string, number> = {};
  const legend: Record<string, string> = {};
  for (let index = 0; index < RELEVANCE_LEVELS.length; index++) {
    const key = String(index);
    const probability = rawProbs[key];
    const label = rawLegend[key];
    if (typeof probability !== "number" || typeof label !== "string") {
      throw new Error("relevance_incomplete");
    }
    probabilities[key] = probability;
    legend[key] = label;
  }
  return {
    type: "score",
    score: row.score,
    confidence: row.confidence,
    probabilities,
    legend,
  };
}

function rethrow(error: unknown): never {
  if (error instanceof TypesafeMisconfiguredError || error instanceof JudgmentFailedError) {
    throw error;
  }
  throw new JudgmentFailedError(error);
}

/**
 * One System One call: route Choice plus per-note include Noul and relevance Score.
 * The answers are stored as returned. Nothing re-checks them with another model.
 */
export async function judgeChatTurn(question: string, notes: readonly NoteInput[]): Promise<ChatJudgedContext> {
  const questions: Record<string, ReturnType<typeof choice> | ReturnType<typeof noul> | ReturnType<typeof score>> = {
    route: choice(
      "Which handling should the app use for `question` given `notes`? answer replies from the notes. propose_edit drafts a note change for a person to approve. none means the notes do not support an answer or an edit.",
      {
        answer: "Reply from the notes. Do not change a note.",
        propose_edit: "Draft a note edit for a person to approve. Do not apply it.",
        none: "No note supports an answer or an edit.",
      },
    ),
  };
  for (let index = 0; index < notes.length; index++) {
    questions[`include_${index}`] = noul(
      `Should \`notes[${index}]\` be included as context for \`question\`? Judge only that note.`,
      {
        true: "The note is useful context for the question.",
        false: "The note should not be included.",
      },
    );
    questions[`relevance_${index}`] = score(
      `How well does \`notes[${index}]\` support answering or editing for \`question\`?`,
      RELEVANCE_LEVELS,
    );
  }

  try {
    const response = await getSystemOneInvoker().systemOne({
      state: {
        question,
        notes: notes.map((note) => ({
          id: note.id,
          title: note.title,
          body: note.body.slice(0, 1200),
        })),
      },
      questions,
    });
    const answers = response.answers as Record<string, unknown>;
    return {
      route: readRoute(answers.route),
      candidates: notes.map((note, index) => ({
        noteId: note.id,
        title: note.title,
        body: note.body,
        include: readNoul(answers[`include_${index}`]),
        relevance: readScore(answers[`relevance_${index}`]),
      })),
    };
  } catch (error) {
    rethrow(error);
  }
}
