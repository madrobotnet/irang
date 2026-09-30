import { INTL_LOCALE, type Locale, type LocalizedText } from "@/lib/i18n/locale";
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

/** Thread-list date (e.g. "Sep 29") in the UI language and the viewer's own time zone. */
export function threadDateFormat(locale: Locale, timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { month: "short", day: "numeric", timeZone });
}
