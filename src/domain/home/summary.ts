import {
  homeEmptyVaultOk,
  homeReadyOk,
  type HomeEmptyVaultOk,
  type HomeReadyOk,
  type RecentNoteListItemDto,
} from "@/lib/home/dto";

export const HOME_RECENT_NOTES_LIMIT = 5;

export function projectHomeSummary(
  recentNotes: readonly RecentNoteListItemDto[],
  inboxCount: number,
): HomeReadyOk | HomeEmptyVaultOk {
  const capped = recentNotes.slice(0, HOME_RECENT_NOTES_LIMIT);
  const first = capped[0];
  if (!first) {
    return homeEmptyVaultOk(inboxCount);
  }
  return homeReadyOk(inboxCount, [first, ...capped.slice(1)]);
}
