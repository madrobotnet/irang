/** Horizontal threshold before a card swipe commits. No spring. */
export const SWIPE_THRESHOLD_PX = 72;

export type SwipeIntent = "promote" | "discard";

/**
 * Right commits 노트화 (open the sheet). Left commits 폐기 (open confirm).
 * Vertical movement wins so the list can still scroll.
 */
export function swipeIntent(deltaX: number, deltaY = 0): SwipeIntent | null {
  if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return null;
  if (Math.abs(deltaY) > Math.abs(deltaX)) return null;
  return deltaX > 0 ? "promote" : "discard";
}
