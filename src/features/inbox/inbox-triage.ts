import { INTL_LOCALE, type Locale } from "@/lib/i18n/locale";
import { inboxUrlStatus, stripInboxUrlStatus } from "@/lib/inbox-url-status";
import type { InboxItem, InboxSuggestions } from "@/lib/types";
import { INBOX_COPY } from "./inbox-copy";

/** Wire shape of GET /api/inbox; also the SWR cache entry the shell badge reads. */
export type InboxListData = { items: InboxItem[]; count: number };

export const INBOX_KEY = "/api/inbox";

export type TriageAction = "next" | "prev" | "first" | "last" | "open" | "promote" | "discard" | "clear";

/**
 * Single-key triage map. Returns null while the user is typing so list keys never
 * steal characters from the title/body fields, and ignores modifier chords so the
 * shell's own bindings (Ctrl+K, Ctrl+P, ...) keep working.
 */
export function resolveTriageKey(input: { key: string; editable: boolean; metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean }): TriageAction | null {
  if (input.metaKey || input.ctrlKey || input.altKey) return null;
  if (input.editable) return null;
  const key = input.key.length === 1 ? input.key.toLowerCase() : input.key;
  switch (key) {
    case "j":
    case "ArrowDown":
      return "next";
    case "k":
    case "ArrowUp":
      return "prev";
    case "Home":
      return "first";
    case "End":
      return "last";
    case "Enter":
    case "o":
      return "open";
    case "p":
      return input.shiftKey ? null : "promote";
    case "d":
    case "#":
      return input.shiftKey && key === "d" ? null : "discard";
    case "Escape":
      return "clear";
    default:
      return null;
  }
}

/** Index of the item that should be selected after moving `delta` from the current one. */
export function moveSelection(items: readonly { id: string }[], currentId: string | null, delta: number): string | null {
  if (items.length === 0) return null;
  const index = currentId === null ? -1 : items.findIndex((item) => item.id === currentId);
  if (index === -1) return (delta >= 0 ? items[0] : items[items.length - 1])!.id;
  const next = Math.min(items.length - 1, Math.max(0, index + delta));
  return items[next]!.id;
}

/** After removing `id`, the neighbour to select: the next item, else the previous, else nothing. */
export function neighbourAfterRemoval(items: readonly { id: string }[], id: string): string | null {
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return null;
  return items[index + 1]?.id ?? items[index - 1]?.id ?? null;
}

export function withoutItem(data: InboxListData | undefined, id: string): InboxListData {
  const items = (data?.items ?? []).filter((item) => item.id !== id);
  return { items, count: items.length };
}

export function withItem(data: InboxListData | undefined, item: InboxItem): InboxListData {
  const items = [item, ...(data?.items ?? []).filter((existing) => existing.id !== item.id)];
  return { items, count: items.length };
}

export function replaceItem(data: InboxListData | undefined, item: InboxItem): InboxListData {
  const items = (data?.items ?? []).map((existing) => (existing.id === item.id ? item : existing));
  return { items, count: items.length };
}

export type TriageDraftState = {
  title: string;
  body: string;
  sourceTitle: string;
  sourceBody: string;
  titleDirty: boolean;
  bodyDirty: boolean;
};

/** Adopt a refreshed server field only when the user has not edited that field. */
export function syncTriageDraft(current: TriageDraftState, sourceTitle: string, sourceBody: string): TriageDraftState {
  if (current.sourceTitle === sourceTitle && current.sourceBody === sourceBody) return current;
  return {
    ...current,
    title: current.titleDirty ? current.title : sourceTitle,
    body: current.bodyDirty ? current.body : sourceBody,
    sourceTitle,
    sourceBody,
  };
}

/** Tags the promote call sends: manual comma/space separated input plus the chosen suggestions, lower-cased and deduped. */
export function mergeTags(manual: string, selected: Iterable<string>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    const tag = raw.trim().replace(/^#/, "").toLowerCase();
    if (!tag || seen.has(tag)) return;
    seen.add(tag);
    out.push(tag);
  };
  for (const part of manual.split(/[,\n]/)) push(part);
  for (const tag of selected) push(tag);
  return out;
}

export type SuggestionView =
  | { kind: "pending" }
  | { kind: "unavailable" }
  | { kind: "failed" }
  | { kind: "ready"; suggestions: InboxSuggestions };

/** How the suggestion panel should read the stored value; null is "not analysed yet", never a spinner. */
export function suggestionView(suggestions: InboxSuggestions | null): SuggestionView {
  if (!suggestions) return { kind: "pending" };
  if (suggestions.status === "unavailable") return { kind: "unavailable" };
  if (suggestions.status === "failed") return { kind: "failed" };
  return { kind: "ready", suggestions };
}

/** Kinds the server asks Jev to choose from; the stored choice stays this machine id. */
export type SuggestionKind = "idea" | "reference" | "task" | "other";

/** Display label for a suggested kind; an unknown id is shown as stored. */
export function kindLabel(choice: string, labels: Readonly<Record<SuggestionKind, string>>): string {
  return Object.hasOwn(labels, choice) ? labels[choice as SuggestionKind] : choice;
}

/** Body text with the server's URL status line removed; that line is UI status, not note content. */
export function stripUrlStatus(body: string): string {
  return stripInboxUrlStatus(body);
}

export function urlStatus(body: string): "pending" | "failed" | null {
  return inboxUrlStatus(body);
}

export function excerpt(body: string, limit = 140): string {
  const text = stripUrlStatus(body).replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

const ABSOLUTE_OPTIONS: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" };

/** One formatter pair per UI language, created where the module loads so dates use the viewer's time zone. */
const FORMATS: Readonly<Record<Locale, { relative: Intl.RelativeTimeFormat; absolute: Intl.DateTimeFormat }>> = {
  ko: { relative: new Intl.RelativeTimeFormat(INTL_LOCALE.ko, { numeric: "auto" }), absolute: new Intl.DateTimeFormat(INTL_LOCALE.ko, ABSOLUTE_OPTIONS) },
  en: { relative: new Intl.RelativeTimeFormat(INTL_LOCALE.en, { numeric: "auto" }), absolute: new Intl.DateTimeFormat(INTL_LOCALE.en, ABSOLUTE_OPTIONS) },
};

export function formatCreated(iso: string, locale: Locale, now = Date.now()): string {
  const { relative, absolute } = FORMATS[locale];
  const then = new Date(iso).getTime();
  const diffMinutes = Math.round((then - now) / 60_000);
  if (Math.abs(diffMinutes) < 1) return INBOX_COPY[locale].justNow;
  if (Math.abs(diffMinutes) < 60) return relative.format(diffMinutes, "minute");
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return relative.format(diffHours, "hour");
  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 7) return relative.format(diffDays, "day");
  return absolute.format(new Date(then));
}

export function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
