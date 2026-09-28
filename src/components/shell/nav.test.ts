import { describe, expect, test } from "bun:test";
import { activeNavId, goToHref, isMoreActive, isNavActive, MOBILE_MORE, MOBILE_PRIMARY, NAV_ITEMS } from "./nav";

describe("nav", () => {
  test("rail order and routes follow the architecture contract", () => {
    expect(NAV_ITEMS.map((i) => [i.label, i.href])).toEqual([
      ["홈", "/"],
      ["인박스", "/inbox"],
      ["노트", "/notes"],
      ["오늘", "/daily"],
      ["검색", "/search"],
      ["그래프", "/graph"],
      ["채팅", "/chat"],
      ["설정", "/settings"],
    ]);
  });

  test("section matching: nested paths activate their section, home only exactly", () => {
    expect(isNavActive("/notes/abc", "/notes")).toBe(true);
    expect(isNavActive("/notesx", "/notes")).toBe(false);
    expect(isNavActive("/notes", "/")).toBe(false);
    expect(activeNavId("/chat/123")).toBe("chat");
    expect(activeNavId("/nowhere")).toBeNull();
  });

  test("mobile bar shows 홈·노트·검색 and 더보기 lights up for the rest", () => {
    expect(MOBILE_PRIMARY).toEqual(["home", "notes", "search"]);
    expect(MOBILE_MORE).toEqual(["inbox", "daily", "graph", "chat", "settings"]);
    expect(isMoreActive("/inbox")).toBe(true);
    expect(isMoreActive("/notes/1")).toBe(false);
  });

  test("go-to chord keys map to routes", () => {
    expect(goToHref("h")).toBe("/");
    expect(goToHref("S")).toBe("/search");
    expect(goToHref("x")).toBeNull();
  });
});
