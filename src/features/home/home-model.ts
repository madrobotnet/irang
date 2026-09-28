import type { HomeData, InboxSource, NoteSummary } from "@/lib/types";

/** Local calendar date as YYYY-MM-DD (the browser's zone, not UTC). */
export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * A cached dashboard can cross midnight. Only trust its daily note when it
 * matches the viewer's current local date.
 */
export function dailyForDate(home: Pick<HomeData, "daily">, today: string): NoteSummary | null {
  return home.daily && home.daily.dailyDate === today ? home.daily : null;
}

/** Pinned notes also appear in the pinned column; keep the recent list for everything else. */
export function recentWithoutPinned(home: Pick<HomeData, "recent" | "pinned">): NoteSummary[] {
  const pinned = new Set(home.pinned.map((note) => note.id));
  return home.recent.filter((note) => !pinned.has(note.id));
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Short Korean relative time against an explicit `now` (keeps render pure and testable). */
export function relativeTime(iso: string, now: number): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const diff = Math.max(0, now - then);
  if (diff < MINUTE) return "방금";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}분 전`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}시간 전`;
  const days = Math.floor(diff / DAY);
  if (days < 7) return days === 1 ? "어제" : `${days}일 전`;
  if (days < 30) return `${Math.floor(days / 7)}주 전`;
  const date = new Date(then);
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return new Intl.DateTimeFormat("ko-KR", sameYear ? { month: "long", day: "numeric" } : { year: "numeric", month: "long", day: "numeric" }).format(date);
}

export const SOURCE_LABEL: Record<InboxSource, string> = {
  web: "직접 입력",
  url: "링크",
  share: "공유",
  api: "API",
};

/** Headline for the top of home, chosen from what actually needs attention. */
export function homeHeadline(home: Pick<HomeData, "inboxCount" | "stats">, hasDaily: boolean): string {
  if (home.inboxCount > 0) return `정리할 캡처가 ${home.inboxCount}개 있어요`;
  if (home.stats.notes === 0) return "첫 생각을 붙잡아 볼까요";
  if (!hasDaily) return "오늘 노트를 시작해 볼까요";
  return "인박스를 모두 정리했어요";
}
