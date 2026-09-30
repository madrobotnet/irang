import { CalendarDays, FileText, House, Inbox, MessageSquare, Search, Settings, Waypoints, type LucideIcon } from "lucide-react";

export type NavId = "home" | "inbox" | "notes" | "daily" | "search" | "graph" | "chat" | "settings";

/** Route, icon and chord key of a rail entry; its visible label is `SHELL_COPY[locale].nav[id]` in copy.ts. */
export type NavItem = {
  id: NavId;
  href: string;
  icon: LucideIcon;
  /** Second key of the `g` go-to chord, when there is one. */
  goKey?: string;
};

/** Desktop rail order (docs/ARCHITECTURE.md "Shell"). */
export const NAV_ITEMS: readonly NavItem[] = [
  { id: "home", href: "/", icon: House, goKey: "h" },
  { id: "inbox", href: "/inbox", icon: Inbox, goKey: "i" },
  { id: "notes", href: "/notes", icon: FileText, goKey: "n" },
  { id: "daily", href: "/daily", icon: CalendarDays },
  { id: "search", href: "/search", icon: Search, goKey: "s" },
  { id: "graph", href: "/graph", icon: Waypoints, goKey: "g" },
  { id: "chat", href: "/chat", icon: MessageSquare, goKey: "c" },
  { id: "settings", href: "/settings", icon: Settings },
];

const BY_ID = new Map(NAV_ITEMS.map((item) => [item.id, item]));

export function navItem(id: NavId): NavItem {
  const item = BY_ID.get(id);
  if (!item) throw new Error(`unknown nav id: ${id}`);
  return item;
}

/** Bottom bar: home · notes · [capture] · search · more. The capture slot is rendered by MobileNav. */
export const MOBILE_PRIMARY: readonly NavId[] = ["home", "notes", "search"];

/** Everything else lives in the "more" sheet, in rail order. */
export const MOBILE_MORE: readonly NavId[] = NAV_ITEMS.filter((item) => !MOBILE_PRIMARY.includes(item.id)).map((item) => item.id);

/** Section match: `/notes/abc` activates notes, but `/` activates only home. */
export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function activeNavId(pathname: string): NavId | null {
  return NAV_ITEMS.find((item) => isNavActive(pathname, item.href))?.id ?? null;
}

/** Whether the mobile bar should highlight "more" for this path. */
export function isMoreActive(pathname: string): boolean {
  const id = activeNavId(pathname);
  return id !== null && MOBILE_MORE.includes(id);
}

/** Resolve the `g` + key chord to a route, or null. */
export function goToHref(key: string): string | null {
  return NAV_ITEMS.find((item) => item.goKey === key.toLowerCase())?.href ?? null;
}
