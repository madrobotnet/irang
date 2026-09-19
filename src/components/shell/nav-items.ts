export type NavItem = {
  href: string;
  label: string;
  match: (pathname: string) => boolean;
};

const morePaths = ["/notes", "/graph", "/settings"];

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "홈",
    match: (p) => p === "/",
  },
  {
    href: "/search",
    label: "검색",
    match: (p) => p === "/search" || p.startsWith("/search/"),
  },
  {
    href: "/inbox",
    label: "Inbox",
    match: (p) => p === "/inbox" || p.startsWith("/inbox/"),
  },
  {
    href: "/chat",
    label: "채팅",
    match: (p) => p === "/chat" || p.startsWith("/chat/"),
  },
  {
    href: "/notes",
    label: "더보기",
    match: (p) => morePaths.some((base) => p === base || p.startsWith(`${base}/`)),
  },
];
