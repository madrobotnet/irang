import { choice, noul, score } from "@typesafe-ai/sdk";
import type { ChoiceJudgment, EvidenceJudgedNote, NoulJudgment, ScoreJudgment } from "@/domain/search/types";
import { JudgmentFailedError, TypesafeMisconfiguredError, getSystemOneInvoker } from "../typesafe/runtime";

const NONE_ID = "none";

const RELEVANCE_LEVELS = [
  "Unrelated to the question.",
  "Mentions the topic but does not answer it.",
  "Partial evidence for the question.",
  "Direct evidence that answers the question.",
] as const;

const SIMILARITY_LEVELS = [
  "Unrelated meaning.",
  "Same broad topic, different meaning.",
  "Closely related meaning.",
  "The same meaning as the query.",
] as const;

export type SearchCandidate = {
  id: string;
  title: string;
  body: string;
};

export type SearchJudgment = {
  answersQuery: NoulJudgment;
  ranking: ChoiceJudgment;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as Record<string, unknown>;
}

function readNoul(value: unknown): NoulJudgment {
  const row = asRecord(value);
  if (!row || row.type !== "noul" || typeof row.noul !== "number") {
    throw new Error("noul_missing");
  }
  if (row.noul < 0 || row.noul > 1) {
    throw new Error("noul_range");
  }
  return { type: "noul", noul: row.noul };
}

function readChoice(value: unknown, keys: readonly string[]): ChoiceJudgment {
  const row = asRecord(value);
  if (!row || row.type !== "choice" || typeof row.choice !== "string") {
    throw new Error("choice_missing");
  }
  if (!keys.includes(row.choice)) {
    throw new Error("choice_invalid");
  }
  const raw = asRecord(row.probabilities);
  if (!raw || typeof row.confidence !== "number") {
    throw new Error("choice_incomplete");
  }
  const probabilities: Record<string, number> = {};
  for (const key of keys) {
    const probability = raw[key];
    if (typeof probability !== "number") {
      throw new Error("choice_incomplete");
    }
    probabilities[key] = probability;
  }
  return {
    type: "choice",
    choice: row.choice,
    confidence: row.confidence,
    probabilities,
  };
}

function readScore(value: unknown, levels: readonly string[]): ScoreJudgment {
  const row = asRecord(value);
  if (!row || row.type !== "score" || typeof row.score !== "number" || typeof row.confidence !== "number") {
    throw new Error("score_missing");
  }
  const rawProbs = asRecord(row.probabilities);
  const rawLegend = asRecord(row.legend);
  if (!rawProbs || !rawLegend) {
    throw new Error("score_incomplete");
  }
  const probabilities: Record<string, number> = {};
  const legend: Record<string, string> = {};
  for (let index = 0; index < levels.length; index++) {
    const key = String(index);
    const probability = rawProbs[key];
    const label = rawLegend[key];
    if (typeof probability !== "number" || typeof label !== "string") {
      throw new Error("score_incomplete");
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

function candidateState(candidates: SearchCandidate[]) {
  return candidates.map((candidate) => ({
    id: candidate.id,
    title: candidate.title,
    body: candidate.body.slice(0, 1200),
  }));
}

function rethrow(error: unknown): never {
  if (error instanceof TypesafeMisconfiguredError || error instanceof JudgmentFailedError) {
    throw error;
  }
  throw new JudgmentFailedError(error);
}

export async function judgeSearch(query: string, candidates: SearchCandidate[]): Promise<SearchJudgment> {
  const keys = [NONE_ID, ...candidates.map((candidate) => candidate.id)];
  const criteria: Record<string, string> = {
    [NONE_ID]: "No candidate note should rank first.",
  };
  for (const candidate of candidates) {
    criteria[candidate.id] = candidate.title.slice(0, 180);
  }
  try {
    const response = await getSystemOneInvoker().systemOne({
      state: { query, candidates: candidateState(candidates) },
      questions: {
        ranking: choice(
          "Which note in `candidates` should rank first for `query`? Choose none when no note should rank first.",
          criteria,
        ),
        answersQuery: noul(
          "Do the notes in `candidates` contain information that answers `query`?",
          {
            true: "At least one note answers the query.",
            false: "The notes do not answer the query.",
          },
        ),
      },
    });
    return {
      ranking: readChoice(response.answers.ranking, keys),
      answersQuery: readNoul(response.answers.answersQuery),
    };
  } catch (error) {
    rethrow(error);
  }
}

export async function judgeEvidence(
  query: string,
  candidates: SearchCandidate[],
): Promise<EvidenceJudgedNote[]> {
  if (candidates.length === 0) {
    try {
      await getSystemOneInvoker().systemOne({
        state: { query, candidates: [] },
        questions: {
          any_evidence: noul(
            "Do the notes in `candidates` contain evidence that answers `query`? The list is empty.",
            {
              true: "An empty list still contains evidence.",
              false: "An empty list contains no evidence.",
            },
          ),
        },
      });
      return [];
    } catch (error) {
      rethrow(error);
    }
  }

  const questions: Record<string, ReturnType<typeof noul> | ReturnType<typeof score>> = {};
  for (let index = 0; index < candidates.length; index++) {
    questions[`answers_${index}`] = noul(
      `Does \`candidates[${index}]\` answer \`query\`? Judge only that note.`,
      {
        true: "The note contains an answer to the query.",
        false: "The note does not answer the query.",
      },
    );
    questions[`relevance_${index}`] = score(
      `How relevant is \`candidates[${index}]\` as evidence for \`query\`?`,
      RELEVANCE_LEVELS,
    );
    questions[`similarity_${index}`] = score(
      `How similar is the meaning of \`candidates[${index}]\` to \`query\`?`,
      SIMILARITY_LEVELS,
    );
  }

  try {
    const response = await getSystemOneInvoker().systemOne({
      state: { query, candidates: candidateState(candidates) },
      questions,
    });
    const answers = response.answers as Record<string, unknown>;
    return candidates.map((candidate, index) => ({
      noteId: candidate.id,
      title: candidate.title,
      answers: readNoul(answers[`answers_${index}`]),
      relevance: readScore(answers[`relevance_${index}`], RELEVANCE_LEVELS),
      similarity: readScore(answers[`similarity_${index}`], SIMILARITY_LEVELS),
    }));
  } catch (error) {
    rethrow(error);
  }
}

export function orderSearchResults<T extends { id: string }>(
  candidates: readonly T[],
  ranking: ChoiceJudgment,
): T[] {
  return [...candidates].sort((left, right) => {
    const delta = (ranking.probabilities[right.id] ?? 0) - (ranking.probabilities[left.id] ?? 0);
    if (delta !== 0) {
      return delta;
    }
    return left.id.localeCompare(right.id);
  });
}
