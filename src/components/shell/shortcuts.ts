import { goToHref } from "./nav";

/** Minimal keyboard event shape so the resolver is testable without a DOM. */
export type KeyInput = {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  /** True when focus is in an input, textarea, contenteditable or CodeMirror. */
  editable: boolean;
};

export type ShortcutAction =
  | { type: "palette" }
  | { type: "switcher" }
  | { type: "capture" }
  | { type: "search" }
  | { type: "go"; href: string };

export type ChordState = { pendingGoAt: number | null };
export const IDLE_CHORD: ChordState = { pendingGoAt: null };

/** Max gap between `g` and its second key. */
export const CHORD_TIMEOUT_MS = 1000;

export type ShortcutResult = { action: ShortcutAction | null; state: ChordState };

/**
 * Pure keymap from docs/ARCHITECTURE.md "Keyboard".
 * Modifier chords work everywhere; single keys are ignored while typing.
 */
export function resolveShortcut(input: KeyInput, state: ChordState, now: number): ShortcutResult {
  const mod = input.metaKey || input.ctrlKey;
  const key = input.key.length === 1 ? input.key.toLowerCase() : input.key;

  if (mod && !input.altKey) {
    if (key === "k" && !input.shiftKey) return { action: { type: "palette" }, state: IDLE_CHORD };
    if (key === "p" && !input.shiftKey) return { action: { type: "switcher" }, state: IDLE_CHORD };
    if (key === " " && input.shiftKey) return { action: { type: "capture" }, state: IDLE_CHORD };
    return { action: null, state: IDLE_CHORD };
  }

  if (input.editable || input.altKey || input.metaKey || input.ctrlKey) return { action: null, state: IDLE_CHORD };

  const pending = state.pendingGoAt !== null && now - state.pendingGoAt <= CHORD_TIMEOUT_MS;
  if (pending) {
    const href = goToHref(key);
    return { action: href ? { type: "go", href } : null, state: IDLE_CHORD };
  }

  if (key === "g") return { action: null, state: { pendingGoAt: now } };
  if (key === "c" && !input.shiftKey) return { action: { type: "capture" }, state: IDLE_CHORD };
  if (key === "/") return { action: { type: "search" }, state: IDLE_CHORD };
  return { action: null, state: IDLE_CHORD };
}

/** DOM check for "user is typing here". */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if ((target as HTMLElement).isContentEditable) return true;
  return target.closest('[contenteditable=""], [contenteditable="true"], .cm-editor, [role="textbox"]') !== null;
}

/** Platform modifier glyph for hints. */
export function modKey(): string {
  if (typeof navigator === "undefined") return "Ctrl";
  return /Mac|iPhone|iPad/.test(navigator.platform) || /Mac OS/.test(navigator.userAgent) ? "⌘" : "Ctrl";
}
