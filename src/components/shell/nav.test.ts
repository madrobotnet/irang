import { describe, expect, test } from "bun:test";
import { activeNavId, goToHref, isMoreActive, isNavActive, MOBILE_MORE, MOBILE_PRIMARY, NAV_ITEMS } from "./nav";

describe("nav", () => {
  test("rail order and routes follow the architecture contract", () => {
    expect(NAV_ITEMS.map((i) => [i.id, i.href])).toEqual([
      ["home", "/"],
      ["inbox", "/inbox"],
      ["notes", "/notes"],
      ["daily", "/daily"],
      ["search", "/search"],
      ["graph", "/graph"],
      ["chat", "/chat"],
      ["settings", "/settings"],
    ]);
  });

  test("section matching: nested paths activate their section, home only exactly", () => {
    expect(isNavActive("/notes/abc", "/notes")).toBe(true);
    expect(isNavActive("/notesx", "/notes")).toBe(false);
    expect(isNavActive("/notes", "/")).toBe(false);
    expect(activeNavId("/chat/123")).toBe("chat");
    expect(activeNavId("/nowhere")).toBeNull();
  });

  test("mobile bar shows home, notes and search; More lights up for the rest", () => {
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
