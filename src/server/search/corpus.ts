import type { SearchSourceDoc } from "@/domain/search/types";
import type { NotesStore } from "../notes/ports";

/** Active notes only. Inbox rows are not search hits (result id is a note id). */
export async function loadActiveNotes(store: NotesStore): Promise<SearchSourceDoc[]> {
  const docs: SearchSourceDoc[] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await store.listNotes({
      limit: 100,
      cursor,
      includeDeleted: false,
    });
    for (const note of page.notes) {
      docs.push({
        id: note.id,
        title: note.title,
        body: note.body,
        status: note.status,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
      });
    }
    if (!page.nextCursor) {
      break;
    }
    cursor = page.nextCursor;
  }
  return docs;
}
