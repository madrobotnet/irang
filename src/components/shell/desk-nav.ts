export type DeskNavId = "home" | "search" | "inbox" | "chat" | "graph";

export type DeskNavItem = {
  id: DeskNavId;
  href: string;
  label: string;
};

/** PC rail order */
export const DESK_RAIL_NAV: readonly DeskNavItem[] = [
  { id: "home", href: "/", label: "홈" },
  { id: "search", href: "/search", label: "검색" },
  { id: "inbox", href: "/inbox", label: "수집" },
  { id: "chat", href: "/chat", label: "채팅" },
  { id: "graph", href: "/graph", label: "관계" },
];

/** Mobile dock order (search center FAB) */
export const DESK_DOCK_NAV: readonly DeskNavItem[] = [
  { id: "home", href: "/", label: "홈" },
  { id: "inbox", href: "/inbox", label: "수집" },
  { id: "search", href: "/search", label: "검색" },
  { id: "chat", href: "/chat", label: "채팅" },
  { id: "graph", href: "/graph", label: "관계" },
];

export function deskNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function deskNavIdForPath(pathname: string): DeskNavId | null {
  for (const item of DESK_RAIL_NAV) {
    if (deskNavActive(pathname, item.href)) return item.id;
  }
  return null;
}
