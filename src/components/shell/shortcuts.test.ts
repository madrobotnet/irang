import { describe, expect, test } from "bun:test";
import { CHORD_TIMEOUT_MS, IDLE_CHORD, resolveShortcut, type KeyInput } from "./shortcuts";

const press = (key: string, extra: Partial<KeyInput> = {}): KeyInput => ({
  key,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  editable: false,
  ...extra,
});

describe("resolveShortcut", () => {
  test("Ctrl/⌘+K opens the palette, Ctrl/⌘+P the note switcher, even while typing", () => {
    expect(resolveShortcut(press("k", { ctrlKey: true, editable: true }), IDLE_CHORD, 0).action).toEqual({ type: "palette" });
    expect(resolveShortcut(press("P", { metaKey: true }), IDLE_CHORD, 0).action).toEqual({ type: "switcher" });
  });

  test("Ctrl/⌘+Shift+Space captures anywhere; plain c only outside editors", () => {
    expect(resolveShortcut(press(" ", { ctrlKey: true, shiftKey: true, editable: true }), IDLE_CHORD, 0).action).toEqual({ type: "capture" });
    expect(resolveShortcut(press("c"), IDLE_CHORD, 0).action).toEqual({ type: "capture" });
    expect(resolveShortcut(press("c", { editable: true }), IDLE_CHORD, 0).action).toBeNull();
    expect(resolveShortcut(press("/", { editable: true }), IDLE_CHORD, 0).action).toBeNull();
  });

  test("g then a section key navigates within the chord window", () => {
    const first = resolveShortcut(press("g"), IDLE_CHORD, 1000);
    expect(first.action).toBeNull();
    expect(first.state.pendingGoAt).toBe(1000);
    expect(resolveShortcut(press("i"), first.state, 1000 + CHORD_TIMEOUT_MS).action).toEqual({ type: "go", href: "/inbox" });
  });

  test("an expired or unknown chord does nothing and resets", () => {
    const first = resolveShortcut(press("g"), IDLE_CHORD, 0);
    expect(resolveShortcut(press("n"), first.state, CHORD_TIMEOUT_MS + 1).action).toBeNull();
    const unknown = resolveShortcut(press("z"), first.state, 10);
    expect(unknown.action).toBeNull();
    expect(unknown.state).toEqual(IDLE_CHORD);
  });

  test("other modifier combos are left to the browser", () => {
    expect(resolveShortcut(press("k", { ctrlKey: true, altKey: true }), IDLE_CHORD, 0).action).toBeNull();
    expect(resolveShortcut(press("c", { altKey: true }), IDLE_CHORD, 0).action).toBeNull();
    expect(resolveShortcut(press("s", { ctrlKey: true }), IDLE_CHORD, 0).action).toBeNull();
  });
});
