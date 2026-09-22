import { choice, noul } from "@typesafe-ai/sdk";
import {
  INBOX_CLASS_VOCABULARY,
  isInboxClassId,
  type InboxClassId,
  type InboxClassification,
} from "@/domain/inbox/classification";
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
  /** Ask the inbox primary-class Choice in the same request as tag Nouls. */
  includeClassification?: boolean;
};

function buildDuplicateCriteria(candidates: CaptureCandidateNote[]): Record<string, null> {
  const criteria: Record<string, null> = { none: null };
  for (const note of candidates) {
    criteria[note.id] = null;
  }
  return criteria;
}

function classificationCriteria(): Record<string, string> {
  return Object.fromEntries(INBOX_CLASS_VOCABULARY.map((entry) => [entry.id, entry.description]));
}

function buildClassificationQuestion(): ReturnType<typeof choice> {
  return choice(
    "Which single class best describes `capture`? Choose unsorted when none of the other classes fit. This answer is a suggestion only and does not apply a tag.",
    classificationCriteria(),
  );
}

export function buildTagQuestions(): Record<string, ReturnType<typeof noul>> {
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

function mapClassification(answer: {
  type?: string;
  choice?: string;
  confidence?: number;
  probabilities?: Record<string, number>;
}): InboxClassification {
  if (answer.type !== "choice" || !answer.choice || !isInboxClassId(answer.choice)) {
    throw new Error("classification_missing");
  }
  if (!answer.probabilities) {
    throw new Error("classification_missing");
  }
  const probabilities = {} as Record<InboxClassId, number>;
  for (const entry of INBOX_CLASS_VOCABULARY) {
    const probability = answer.probabilities[entry.id];
    if (typeof probability !== "number") {
      throw new Error("classification_incomplete");
    }
    probabilities[entry.id] = probability;
  }
  return {
    choice: answer.choice,
    probability: probabilities[answer.choice],
    confidence: typeof answer.confidence === "number" ? answer.confidence : 0,
    probabilities,
  };
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
  const includeClassification = input.includeClassification === true;

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
        ...(includeClassification ? { classification: buildClassificationQuestion() } : {}),
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
    const classification = includeClassification
      ? mapClassification(
          (response.answers as { classification?: {
            type?: string;
            choice?: string;
            confidence?: number;
            probabilities?: Record<string, number>;
          } }).classification ?? {},
        )
      : undefined;

    return {
      suggestions: classification ? { tags, classification } : { tags },
      duplicateHint,
    };
  } catch (error) {
    if (error instanceof JudgmentFailedError) {
      throw error;
    }
    throw new JudgmentFailedError(error);
  }
}
