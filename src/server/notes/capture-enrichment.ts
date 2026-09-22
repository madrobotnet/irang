import type { CaptureJudgments } from "@/domain/judgments/types";
import { evaluateCaptureJudgments } from "@/server/typesafe/capture-judgments";
import type { NotesStore } from "./ports";

export async function judgmentsForCapture(
  store: NotesStore,
  title: string,
  body: string,
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
  });
}
