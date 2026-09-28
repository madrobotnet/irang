import { CalendarDays, FileText, House, Inbox, MessageSquare, Search, Settings, Waypoints, type LucideIcon } from "lucide-react";

export type NavId = "home" | "inbox" | "notes" | "daily" | "search" | "graph" | "chat" | "settings";

export type NavItem = {
  id: NavId;
  href: string;
  label: string;
  icon: LucideIcon;
  /** Second key of the `g` go-to chord, when there is one. */
  goKey?: string;
};

/** Desktop rail order (docs/ARCHITECTURE.md "Shell"). */
export const NAV_ITEMS: readonly NavItem[] = [
  { id: "home", href: "/", label: "홈", icon: House, goKey: "h" },
  { id: "inbox", href: "/inbox", label: "인박스", icon: Inbox, goKey: "i" },
  { id: "notes", href: "/notes", label: "노트", icon: FileText, goKey: "n" },
  { id: "daily", href: "/daily", label: "오늘", icon: CalendarDays },
  { id: "search", href: "/search", label: "검색", icon: Search, goKey: "s" },
  { id: "graph", href: "/graph", label: "그래프", icon: Waypoints, goKey: "g" },
  { id: "chat", href: "/chat", label: "채팅", icon: MessageSquare, goKey: "c" },
  { id: "settings", href: "/settings", label: "설정", icon: Settings },
];

const BY_ID = new Map(NAV_ITEMS.map((item) => [item.id, item]));

export function navItem(id: NavId): NavItem {
  const item = BY_ID.get(id);
  if (!item) throw new Error(`unknown nav id: ${id}`);
  return item;
}

/** Bottom bar: 홈 · 노트 · [캡처] · 검색 · 더보기. The capture slot is rendered by MobileNav. */
export const MOBILE_PRIMARY: readonly NavId[] = ["home", "notes", "search"];

/** Everything else lives in the 더보기 sheet, in rail order. */
export const MOBILE_MORE: readonly NavId[] = NAV_ITEMS.filter((item) => !MOBILE_PRIMARY.includes(item.id)).map((item) => item.id);

/** Section match: `/notes/abc` activates 노트, but `/` activates only 홈. */
export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function activeNavId(pathname: string): NavId | null {
  return NAV_ITEMS.find((item) => isNavActive(pathname, item.href))?.id ?? null;
}

/** Whether the mobile bar should highlight 더보기 for this path. */
export function isMoreActive(pathname: string): boolean {
  const id = activeNavId(pathname);
  return id !== null && MOBILE_MORE.includes(id);
}

/** Resolve the `g` + key chord to a route, or null. */
export function goToHref(key: string): string | null {
  return NAV_ITEMS.find((item) => item.goKey === key.toLowerCase())?.href ?? null;
}
