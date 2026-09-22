import { getSearchIndex } from "./runtime";

/** Clear stale embeddings after a note write. Failures stay on the search endpoints. */
export async function notifySearchCorpusChanged(): Promise<void> {
  try {
    const index = await getSearchIndex();
    await index.prepare();
  } catch {
    return;
  }
}
