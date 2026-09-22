import { choice, noul } from "@typesafe-ai/sdk";
import type { CaptureJudgments, DuplicateHint, TagSuggestion } from "@/domain/judgments/types";
import {
  CAPTURE_TAG_VOCABULARY,
  TAG_SUGGESTION_MIN_PROBABILITY,
} from "@/domain/judgments/tag-vocabulary";
import { JudgmentFailedError, getSystemOneInvoker } from "./runtime";

export type CaptureCandidateNote = {
  id: string;
  title: string;
  body: string;
};

export type CaptureJudgmentInput = {
  title: string;
  body: string;
  candidates: CaptureCandidateNote[];
};

function buildDuplicateCriteria(candidates: CaptureCandidateNote[]): Record<string, null> {
  const criteria: Record<string, null> = { none: null };
  for (const note of candidates) {
    criteria[note.id] = null;
  }
  return criteria;
}

function buildTagQuestions(): Record<string, ReturnType<typeof noul>> {
  const questions: Record<string, ReturnType<typeof noul>> = {};
  for (const entry of CAPTURE_TAG_VOCABULARY) {
    questions[`tag_${entry.tag}`] = noul(
      `Given \`capture\`, should the "${entry.tag}" tag be suggested to the user? (${entry.description})`,
      {
        true: "The tag is a reasonable suggestion for this capture.",
        false: "The tag is not a reasonable suggestion.",
      },
    );
  }
  return questions;
}

function mapTagSuggestions(
  answers: Record<string, { type: string; noul?: number }>,
): TagSuggestion[] {
  const tags: TagSuggestion[] = [];
  for (const entry of CAPTURE_TAG_VOCABULARY) {
    const answer = answers[`tag_${entry.tag}`];
    if (answer?.type === "noul" && typeof answer.noul === "number") {
      if (answer.noul >= TAG_SUGGESTION_MIN_PROBABILITY) {
        tags.push({ tag: entry.tag, probability: answer.noul });
      }
    }
  }
  tags.sort((a, b) => b.probability - a.probability);
  return tags;
}

function mapDuplicateHint(
  answers: Record<string, { type: string; choice?: string; confidence?: number; probabilities?: Record<string, number> }>,
): DuplicateHint | null {
  const duplicate = answers.duplicate_match;
  if (duplicate?.type !== "choice" || !duplicate.choice || !duplicate.probabilities) {
    return null;
  }
  const choiceKey = duplicate.choice;
  const probability = duplicate.probabilities[choiceKey] ?? 0;
  const confidence = duplicate.confidence ?? 0;
  if (choiceKey === "none") {
    return {
      relatedNoteId: null,
      choice: choiceKey,
      probability,
      confidence,
    };
  }
  return {
    relatedNoteId: choiceKey,
    choice: choiceKey,
    probability,
    confidence,
  };
}

export async function evaluateCaptureJudgments(
  input: CaptureJudgmentInput,
): Promise<CaptureJudgments> {
  const invoker = getSystemOneInvoker();
  const tagQuestions = buildTagQuestions();
  const hasCandidates = input.candidates.length > 0;
  const duplicateCriteria = hasCandidates ? buildDuplicateCriteria(input.candidates) : null;

  try {
    const response = await invoker.systemOne({
      state: {
        capture: {
          title: input.title,
          body: input.body.slice(0, 4000),
        },
        existing_notes: input.candidates.map((n) => ({
          id: n.id,
          title: n.title,
          body: n.body.slice(0, 800),
        })),
      },
      questions: {
        ...(duplicateCriteria
          ? {
              duplicate_match: choice(
                "Which existing note in `existing_notes`, if any, is substantially the same content as `capture`? Choose none when no note is a duplicate.",
                duplicateCriteria,
              ),
            }
          : {}),
        ...tagQuestions,
      },
    });

    const tags = mapTagSuggestions(response.answers as Record<string, { type: string; noul?: number }>);
    const duplicateHint = duplicateCriteria
      ? mapDuplicateHint(
          response.answers as Record<string, {
            type: string;
            choice?: string;
            confidence?: number;
            probabilities?: Record<string, number>;
          }>,
        )
      : null;

    return {
      suggestions: { tags },
      duplicateHint,
    };
  } catch (error) {
    throw new JudgmentFailedError(error);
  }
}
