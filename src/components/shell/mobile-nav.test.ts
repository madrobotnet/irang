import { describe, expect, it, vi } from "vitest";
import {
  goStackBack,
  hasStackHistory,
  isTop3Root,
  mobileChromeKind,
  MORE_SHEET_LINKS,
  MORE_SHEET_LOGOUT_ACTION,
  stackTitleForPath,
} from "./mobile-nav";

describe("mobile chrome routes", () => {
  it("uses MobileTopChrome on Top3 roots", () => {
    expect(isTop3Root("/")).toBe(true);
    expect(isTop3Root("/chat")).toBe(true);
    expect(isTop3Root("/chat/abc")).toBe(true);
    expect(mobileChromeKind("/")).toBe("top");
    expect(mobileChromeKind("/chat")).toBe("top");
  });

  it("uses MobileStackHeader on inbox, notes, search, and settings", () => {
    expect(mobileChromeKind("/inbox")).toBe("stack");
    expect(mobileChromeKind("/notes")).toBe("stack");
    expect(mobileChromeKind("/notes/n1")).toBe("stack");
    expect(mobileChromeKind("/search")).toBe("stack");
    expect(mobileChromeKind("/settings")).toBe("stack");
    expect(stackTitleForPath("/inbox")).toBe("Inbox");
    expect(stackTitleForPath("/notes")).toBe("노트");
    expect(stackTitleForPath("/search")).toBe("검색");
    expect(stackTitleForPath("/settings")).toBe("설정");
  });

  it("does not add a second toolbar on /graph (follow existing page chrome)", () => {
    expect(mobileChromeKind("/graph")).toBe("none");
    expect(stackTitleForPath("/graph")).toBeNull();
  });
});

describe("MoreSheet destinations", () => {
  it("matches desktop instrument routes plus Inbox", () => {
    expect(MORE_SHEET_LINKS.map((row) => [row.href, row.label])).toEqual([
      ["/inbox", "Inbox"],
      ["/notes", "노트"],
      ["/graph", "그래프"],
      ["/settings", "설정"],
    ]);
    expect(MORE_SHEET_LOGOUT_ACTION).toBe("/api/auth/logout");
  });
});

describe("stack back", () => {
  it("calls router.back when Next history idx is above the root", () => {
    const back = vi.fn();
    const replace = vi.fn();
    expect(hasStackHistory({ length: 3, state: { idx: 2 } })).toBe(true);
    goStackBack({ back, replace }, { length: 3, state: { idx: 2 } });
    expect(back).toHaveBeenCalledOnce();
    expect(replace).not.toHaveBeenCalled();
  });

  it("replaces to / when there is no stack history", () => {
    const back = vi.fn();
    const replace = vi.fn();
    expect(hasStackHistory({ length: 1, state: { idx: 0 } })).toBe(false);
    goStackBack({ back, replace }, { length: 1, state: { idx: 0 } });
    expect(back).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("falls back to history.length when idx is missing", () => {
    expect(hasStackHistory({ length: 1, state: null })).toBe(false);
    expect(hasStackHistory({ length: 2, state: null })).toBe(true);
  });
});
