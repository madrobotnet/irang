import type { Locale, LocalizedText } from "@/lib/i18n/locale";
import type { Citation } from "@/lib/types";
import { CHAT_COPY } from "./copy";
import type { StreamOutcome } from "./sse";

/** A terminal outcome other than success. Kept as data in state so its text follows the UI language. */
export type StreamFailure = Exclude<StreamOutcome, { kind: "done" }>;

type FailureCopyKey = "unavailable" | "conflict" | "notFound" | "upstreamFailed" | "internal";

/** Error codes with chat-specific copy. A Map, so inherited object keys such as "constructor" never match. */
const ERROR_COPY = new Map<string, FailureCopyKey>([
  ["unavailable", "unavailable"],
  ["conflict", "conflict"],
  ["not_found", "notFound"],
  ["upstream_failed", "upstreamFailed"],
  ["internal", "internal"],
]);

/**
 * Text for a failed exchange in `locale`, derived at render time so a language switch re-renders it.
 * Known codes use chat copy; any other code uses the server's localized text when it sent one.
 * The server's `message` (an English or legacy diagnostic) is never shown, so provider or
 * validation output cannot reach the screen.
 */
export function failureMessage(failure: StreamFailure, locale: Locale): string {
  const copy = CHAT_COPY[locale];
  switch (failure.kind) {
    case "aborted":
      return copy.stopped;
    case "incomplete":
      return failure.reason === "malformed" ? copy.malformed : failure.reason === "network" ? copy.network : copy.incomplete;
    case "error": {
      const key = ERROR_COPY.get(failure.code);
      if (key) return copy[key];
      const localized = failure.localized?.[locale];
      return typeof localized === "string" && localized.trim() ? localized : copy.unknown;
    }
  }
}

/**
 * Titles the server gives a thread created without one, by request language. While a thread still
 * has one, its first question becomes its title. Stored titles are user data: this only decides
 * whether that automatic rename applies and is never used to translate a title for display.
 */
export const DEFAULT_THREAD_TITLES: LocalizedText = { ko: "새 대화", en: "New chat" };

export function isDefaultThreadTitle(title: string | null | undefined): boolean {
  return title === DEFAULT_THREAD_TITLES.ko || title === DEFAULT_THREAD_TITLES.en;
}

/** Fenced blocks and inline code, where `[1]` is code (an index), not a citation. */
const CODE = /```[\s\S]*?(?:```|$)|`[^`\n]*`/g;
/**
 * A bracketed citation marker as the grounding prompt numbers sources: "[3]", "[1, 2]", "[2-4]",
 * optionally labelled "[출처 3]" / "[Source 3]". A following "(" makes it Markdown link text instead.
 */
const MARKER = /\[(?:(?:출처|source)\s*)?(\d{1,3}(?:\s*[,–-]\s*\d{1,3})*)\](?!\()/giu;
const MAX_RANGE = 20;

/** Source numbers an answer cites with bracketed markers, ignoring code. */
export function citedIndices(answer: string): Set<number> {
  const cited = new Set<number>();
  for (const [, list = ""] of answer.replace(CODE, " ").matchAll(MARKER)) {
    for (const item of list.split(",")) {
      const [start = NaN, end = start] = item.split(/[–-]/).map((part) => Number(part.trim()));
      if (end < start || end - start > MAX_RANGE) continue;
      for (let index = start; index <= end; index += 1) cited.add(index);
    }
  }
  return cited;
}

/**
 * Splits retrieved sources into the ones the answer cites and the rest, each in source order.
 * An answer without a marker for any of them claims nothing, so every source stays in `cited`.
 */
export function partitionCitations(answer: string, citations: readonly Citation[]): { cited: Citation[]; others: Citation[] } {
  const indices = citedIndices(answer);
  const cited = citations.filter((citation) => indices.has(citation.index));
  if (cited.length === 0) return { cited: [...citations], others: [] };
  return { cited, others: citations.filter((citation) => !indices.has(citation.index)) };
}
