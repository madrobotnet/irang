export const MOBILE_NAV_COPY = {
  menu: "메뉴",
  closeMenu: "메뉴 닫기",
  back: "이전",
  topChrome: "모바일 상단",
  stackHeader: "스택 헤더",
  inbox: "Inbox",
  notes: "노트",
  graph: "그래프",
  settings: "설정",
  search: "검색",
  logout: "나가기",
} as const;

export const MORE_SHEET_LINKS = [
  { href: "/inbox", label: MOBILE_NAV_COPY.inbox, glyph: "▣" },
  { href: "/notes", label: MOBILE_NAV_COPY.notes, glyph: "✎" },
  { href: "/graph", label: MOBILE_NAV_COPY.graph, glyph: "◎" },
  { href: "/settings", label: MOBILE_NAV_COPY.settings, glyph: "⚙" },
] as const;

export const MORE_SHEET_LOGOUT_ACTION = "/api/auth/logout";

export type MobileChromeKind = "top" | "stack" | "none";

const STACK_TITLES: ReadonlyArray<{ prefix: string; title: string }> = [
  { prefix: "/inbox", title: MOBILE_NAV_COPY.inbox },
  { prefix: "/notes", title: MOBILE_NAV_COPY.notes },
  { prefix: "/search", title: MOBILE_NAV_COPY.search },
  { prefix: "/settings", title: MOBILE_NAV_COPY.settings },
];

function pathMatches(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function isTop3Root(pathname: string): boolean {
  if (pathname === "/") return true;
  return pathMatches(pathname, "/chat");
}

export function stackTitleForPath(pathname: string): string | null {
  if (isTop3Root(pathname)) return null;
  for (const row of STACK_TITLES) {
    if (pathMatches(pathname, row.prefix)) return row.title;
  }
  return null;
}

export function mobileChromeKind(pathname: string): MobileChromeKind {
  if (pathname === "/login" || pathMatches(pathname, "/login")) return "none";
  if (isTop3Root(pathname)) return "top";
  if (stackTitleForPath(pathname)) return "stack";
  return "none";
}

export type HistoryLike = {
  length: number;
  state: unknown;
};

export function hasStackHistory(history: HistoryLike): boolean {
  const idx = (history.state as { idx?: number } | null)?.idx;
  if (typeof idx === "number") return idx > 0;
  return history.length > 1;
}

export function goStackBack(
  router: { back: () => void; replace: (href: string) => void },
  history: HistoryLike,
): void {
  if (hasStackHistory(history)) {
    router.back();
    return;
  }
  router.replace("/");
}
