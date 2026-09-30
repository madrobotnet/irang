import { describe, expect, test } from "bun:test";
import { activeNavId, goToHref, isMoreActive, isNavActive, MOBILE_MORE, MOBILE_PRIMARY, NAV_ITEMS } from "./nav";

describe("nav", () => {
  test("rail order and routes follow the architecture contract", () => {
    expect(NAV_ITEMS.map((i) => [i.id, i.href])).toEqual([
      ["home", "/"],
      ["inbox", "/inbox"],
      ["notes", "/notes"],
      ["tasks", "/tasks"],
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

  test("mobile bar shows home, inbox and notes; More lights up for the rest", () => {
    expect(MOBILE_PRIMARY).toEqual(["home", "inbox", "notes"]);
    expect(MOBILE_MORE).toEqual(["tasks", "daily", "search", "graph", "chat", "settings"]);
    expect(isMoreActive("/search")).toBe(true);
    expect(isMoreActive("/tasks")).toBe(true);
    expect(isMoreActive("/inbox")).toBe(false);
    expect(isMoreActive("/notes/1")).toBe(false);
  });

  test("go-to chord keys map to routes", () => {
    expect(goToHref("h")).toBe("/");
    expect(goToHref("S")).toBe("/search");
    expect(goToHref("t")).toBe("/tasks");
    expect(goToHref("x")).toBeNull();
  });

  test("chord keys are unique single letters, so no two destinations share a chord", () => {
    const keys = NAV_ITEMS.flatMap((item) => (item.goKey ? [item.goKey] : []));
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(/^[a-z]$/);
  });
});
