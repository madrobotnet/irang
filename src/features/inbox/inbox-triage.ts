import { formatDateTime } from "@/lib/i18n/format-date";
import { INTL_LOCALE, type Locale } from "@/lib/i18n/locale";
import { inboxUrlStatus, stripInboxUrlStatus } from "@/lib/inbox-url-status";
import type { InboxItem, InboxSuggestions, NoteTitleMatch } from "@/lib/types";
import { INBOX_COPY } from "./inbox-copy";

/** Wire shape of GET /api/inbox; also the SWR cache entry the shell badge reads. */
export type InboxListData = { items: InboxItem[]; count: number; snoozedCount: number; nextReturnAt: string | null };

export const INBOX_KEY = "/api/inbox";
export const INBOX_LATER_KEY = "/api/inbox?view=later";

export type InboxView = "open" | "later";

export type TriageAction = "next" | "prev" | "first" | "last" | "open" | "promote" | "discard" | "merge" | "snooze" | "clear";

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
    // Digits keep Shift: some layouts (AZERTY) need it to type them.
    case "1":
      return "promote";
    case "p":
      return input.shiftKey ? null : "promote";
    case "2":
    case "#":
      return "discard";
    case "d":
      return input.shiftKey ? null : "discard";
    case "3":
      return "merge";
    case "h":
      return "snooze";
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

function listData(items: InboxItem[], snoozedCount: number, nextReturnAt: string | null): InboxListData {
  return { items, count: items.length, snoozedCount: Math.max(0, snoozedCount), nextReturnAt };
}

export function withoutItem(data: InboxListData | undefined, id: string): InboxListData {
  return listData((data?.items ?? []).filter((item) => item.id !== id), data?.snoozedCount ?? 0, data?.nextReturnAt ?? null);
}

export function withItem(data: InboxListData | undefined, item: InboxItem): InboxListData {
  return listData([item, ...(data?.items ?? []).filter((existing) => existing.id !== item.id)], data?.snoozedCount ?? 0, data?.nextReturnAt ?? null);
}

export function replaceItem(data: InboxListData | undefined, item: InboxItem): InboxListData {
  return listData((data?.items ?? []).map((existing) => (existing.id === item.id ? item : existing)), data?.snoozedCount ?? 0, data?.nextReturnAt ?? null);
}

const sooner = (a: string | null, b: string | null): string | null =>
  a === null ? b : b === null ? a : Date.parse(b) < Date.parse(a) ? b : a;

/** Server order: open is newest capture first, later is soonest return first; both break ties by id. */
function comesBefore(view: InboxView, a: InboxItem, b: InboxItem): boolean {
  if (view === "open") {
    const diff = Date.parse(a.createdAt) - Date.parse(b.createdAt);
    return diff !== 0 ? diff > 0 : a.id > b.id;
  }
  const diff = Date.parse(a.snoozedUntil ?? "") - Date.parse(b.snoozedUntil ?? "");
  return diff !== 0 ? diff < 0 : a.id < b.id;
}

/** `item` placed where the server would list it, replacing any stale copy. */
export function insertInOrder(items: readonly InboxItem[], item: InboxItem, view: InboxView): InboxItem[] {
  const rest = items.filter((existing) => existing.id !== item.id);
  const index = rest.findIndex((existing) => comesBefore(view, item, existing));
  return index === -1 ? [...rest, item] : [...rest.slice(0, index), item, ...rest.slice(index)];
}

export type InboxChange =
  /** Discarded, promoted or merged: gone from every view. */
  | { type: "removed"; id: string }
  /** A discard was undone. */
  | { type: "restored"; item: InboxItem }
  | { type: "snoozed"; item: InboxItem }
  | { type: "unsnoozed"; item: InboxItem };

/**
 * One triage result applied to one cached view, so the list, `count` and the Later
 * badge (`snoozedCount`) move together without a refetch. Counts only change when
 * the view actually gains or loses the item, so replaying a change is harmless. A snooze
 * can only bring `nextReturnAt` forward; other changes keep it, and a time left stale by
 * them costs one extra refetch, which corrects it.
 */
export function applyInboxChange(view: InboxView, data: InboxListData | undefined, change: InboxChange): InboxListData {
  const items = data?.items ?? [];
  const snoozed = data?.snoozedCount ?? 0;
  const next = data?.nextReturnAt ?? null;
  if (change.type === "removed") return withoutItem(data, change.id);
  const { item } = change;
  const present = items.some((existing) => existing.id === item.id);
  const without = items.filter((existing) => existing.id !== item.id);
  switch (change.type) {
    case "restored":
      return view === "open" ? listData(insertInOrder(items, item, "open"), snoozed, next) : listData([...items], snoozed, next);
    case "snoozed": {
      const soonest = sooner(next, item.snoozedUntil);
      return view === "open"
        ? listData(without, snoozed + (present ? 1 : 0), soonest)
        : listData(insertInOrder(items, item, "later"), snoozed + (present ? 0 : 1), soonest);
    }
    case "unsnoozed":
      return view === "open"
        ? listData(insertInOrder(items, item, "open"), snoozed - (present ? 0 : 1), next)
        : listData(without, snoozed - (present ? 1 : 0), next);
  }
}

// setTimeout fires at once for longer delays; a return further off is re-checked after this.
const MAX_TIMER_MS = 2 ** 31 - 1;

/**
 * Milliseconds until the inbox should be refetched because a snoozed item comes back, or
 * null when nothing is snoozed. A second of slack lets the server's clock pass the return
 * time first; a return that is already due is re-checked every five seconds until it lands.
 */
export function snoozeRefreshDelay(nextReturnAt: string | null, now: number): number | null {
  if (nextReturnAt === null) return null;
  const at = Date.parse(nextReturnAt);
  if (Number.isNaN(at)) return null;
  return Math.min(Math.max(at - now + 1_000, 5_000), MAX_TIMER_MS);
}

export type SnoozePresetId = "evening" | "tomorrow" | "nextMonday";
export type SnoozePreset = { id: SnoozePresetId; until: Date };

/**
 * Snooze presets in the viewer's local time: this evening at 18:00 (offered before 17:00),
 * tomorrow at 09:00 and next Monday at 09:00. On Sunday next Monday is tomorrow, so it is
 * left out rather than listed twice.
 */
export function snoozePresets(now: Date): SnoozePreset[] {
  const at = (daysAhead: number, hour: number) => {
    const time = new Date(now);
    time.setDate(time.getDate() + daysAhead);
    time.setHours(hour, 0, 0, 0);
    return time;
  };
  const presets: SnoozePreset[] = [];
  if (now.getHours() < 17) presets.push({ id: "evening", until: at(0, 18) });
  presets.push({ id: "tomorrow", until: at(1, 9) });
  const daysToMonday = (8 - now.getDay()) % 7 || 7;
  if (daysToMonday > 1) presets.push({ id: "nextMonday", until: at(daysToMonday, 9) });
  return presets;
}

/** Latest allowed snooze: one calendar year ahead, the same bound the server checks. */
export function snoozeLimit(now: Date): Date {
  const limit = new Date(now);
  limit.setUTCFullYear(limit.getUTCFullYear() + 1);
  return limit;
}

const pad = (value: number) => String(value).padStart(2, "0");

/** Local `YYYY-MM-DDTHH:mm`, the value format of `<input type="datetime-local">`. */
export function toDateTimeLocalValue(time: Date): string {
  return `${time.getFullYear()}-${pad(time.getMonth() + 1)}-${pad(time.getDate())}T${pad(time.getHours())}:${pad(time.getMinutes())}`;
}

export type SnoozeInput = { ok: true; until: Date } | { ok: false; reason: "invalid" | "past" | "tooFar" };

/** Reads a datetime-local value as local time and checks it is in the future and within a year. */
export function parseSnoozeInput(value: string, now: Date): SnoozeInput {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(value.trim());
  if (!match) return { ok: false, reason: "invalid" };
  const [year, month, day, hour, minute] = match.slice(1, 6).map(Number) as [number, number, number, number, number];
  const until = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (hour > 23 || minute > 59 || until.getFullYear() !== year || until.getMonth() !== month - 1 || until.getDate() !== day) {
    return { ok: false, reason: "invalid" };
  }
  if (until.getTime() <= now.getTime()) return { ok: false, reason: "past" };
  if (until.getTime() > snoozeLimit(now).getTime()) return { ok: false, reason: "tooFar" };
  return { ok: true, until };
}

/** True while `snoozedUntil` is still ahead of `now`. */
export function isSnoozed(item: Pick<InboxItem, "snoozedUntil">, now: number): boolean {
  return item.snoozedUntil !== null && Date.parse(item.snoozedUntil) > now;
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

/** The block POST /api/inbox/:id/merge appends to the note: the stored text (or title), plus the URL when the text lacks it. */
export function mergeBlock(item: Pick<InboxItem, "title" | "body" | "url">): string {
  const text = stripUrlStatus(item.body) || item.title;
  return item.url && !text.includes(item.url) ? `${text}\n\n${item.url}` : text;
}

export type MergeOption = { id: string; title: string; matchedAlias: string | null; suggested: boolean };

/**
 * Merge targets: with an empty query Jev's duplicate suggestion leads, followed by the
 * other titles; a typed query shows only the matches, still marking the suggestion.
 */
export function mergeOptions(
  results: readonly NoteTitleMatch[],
  suggestion: { noteId: string; title: string } | null,
  query: string,
): MergeOption[] {
  const options = results.map((note) => ({ id: note.id, title: note.title, matchedAlias: note.matchedAlias, suggested: note.id === suggestion?.noteId }));
  if (!suggestion || query.trim() !== "") return options;
  return [
    { id: suggestion.noteId, title: suggestion.title, matchedAlias: null, suggested: true },
    ...options.filter((option) => option.id !== suggestion.noteId),
  ];
}

export function excerpt(body: string, limit = 140): string {
  const text = stripUrlStatus(body).replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

const RELATIVE: Readonly<Record<Locale, Intl.RelativeTimeFormat>> = {
  ko: new Intl.RelativeTimeFormat(INTL_LOCALE.ko, { numeric: "auto" }),
  en: new Intl.RelativeTimeFormat(INTL_LOCALE.en, { numeric: "auto" }),
};

/** Relative time for the last week, then the shared absolute date and time (viewer's time zone). */
export function formatCreated(iso: string, locale: Locale, now = Date.now()): string {
  const relative = RELATIVE[locale];
  const then = new Date(iso).getTime();
  const diffMinutes = Math.round((then - now) / 60_000);
  if (Math.abs(diffMinutes) < 1) return INBOX_COPY[locale].justNow;
  if (Math.abs(diffMinutes) < 60) return relative.format(diffMinutes, "minute");
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return relative.format(diffHours, "hour");
  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 7) return relative.format(diffDays, "day");
  return formatDateTime(then, locale);
}

export function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
