import { E3_DEV_GATES } from "@/domain/inbox/dev-process-gates";
import type { CaptureJudgments } from "@/domain/judgments/types";
import { evaluateCaptureJudgments } from "@/server/typesafe/capture-judgments";
import type { NotesStore } from "./ports";

export function inboxClassificationEnabled(): boolean {
  return E3_DEV_GATES.classificationShape === "choice_plus_tag_nouls";
}

export async function judgmentsForCapture(
  store: NotesStore,
  title: string,
  body: string,
  options?: { includeClassification?: boolean },
): Promise<CaptureJudgments> {
  const { notes } = await store.listNotes({
    limit: 50,
    includeDeleted: false,
  });
  return evaluateCaptureJudgments({
    title,
    body,
    candidates: notes.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
    })),
    includeClassification: options?.includeClassification === true,
  });
}

/** Tag Nouls plus the primary-class Choice. No duplicate question. */
export async function judgmentsForInboxSuggestion(
  title: string,
  body: string,
): Promise<CaptureJudgments> {
  return evaluateCaptureJudgments({
    title,
    body,
    candidates: [],
    includeClassification: inboxClassificationEnabled(),
  });
}
