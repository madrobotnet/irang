import { HOME_RECENT_NOTES_LIMIT, projectHomeSummary } from "@/domain/home/summary";
import { MAX_LIST_LIMIT } from "@/domain/notes/constants";
import { homeErrorBody } from "@/lib/home/dto";
import { jsonResponse } from "@/server/http/json-response";
import type { NotesStore } from "@/server/notes/ports";
import { getNotesStore } from "@/server/notes/runtime";

async function countPendingInbox(store: NotesStore): Promise<number> {
  let total = 0;
  let cursor: string | undefined;
  const seen = new Set<string>();
  for (;;) {
    const page = await store.listInboxItems({
      limit: MAX_LIST_LIMIT,
      cursor,
      includeClosed: false,
    });
    total += page.items.length;
    if (!page.nextCursor) {
      return total;
    }
    if (page.items.length === 0 || seen.has(page.nextCursor)) {
      throw new Error("inbox page did not advance");
    }
    seen.add(page.nextCursor);
    cursor = page.nextCursor;
  }
}

export async function handleGetHome(): Promise<Response> {
  try {
    const store = await getNotesStore();
    const [listed, inboxCount] = await Promise.all([
      store.listNotes({
        limit: HOME_RECENT_NOTES_LIMIT,
        includeDeleted: false,
      }),
      countPendingInbox(store),
    ]);
    const recentNotes = listed.notes.map((note) => ({
      id: note.id,
      title: note.title,
      updatedAt: note.updatedAt,
    }));
    return jsonResponse(projectHomeSummary(recentNotes, inboxCount), 200);
  } catch {
    return jsonResponse(homeErrorBody("summary_failed"), 500);
  }
}
