import { OVERNIGHT_INDEX_LIMIT } from "@/domain/search/dev-process-gates";
import { embedText } from "@/domain/search/embed";
import { loadActiveNotes } from "./corpus";
import { getSearchIndex } from "./runtime";
import { getNotesStore } from "../notes/runtime";

export type IndexBatchResult = {
  embedded: number;
  pending: number;
  indexed: number;
};

/** Night-style embed of notes that are keyword-visible but still missing a vector. */
export async function runOvernightIndexBatch(limit = OVERNIGHT_INDEX_LIMIT): Promise<IndexBatchResult> {
  const store = await getNotesStore();
  const index = await getSearchIndex();
  await index.prepare();
  await index.sync(await loadActiveNotes(store));
  const pending = await index.listPending(limit);
  for (const doc of pending) {
    await index.saveEmbedding(doc.id, embedText(`${doc.title}\n${doc.body}`));
  }
  const counts = await index.counts();
  return { embedded: pending.length, pending: counts.pending, indexed: counts.indexed };
}
