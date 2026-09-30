import { describe, expect, test } from "bun:test";
import { INTL_LOCALE, LOCALES } from "@/lib/i18n/locale";
import { DEFAULT_THREAD_TITLES, failureMessage, isDefaultThreadTitle, threadDateFormat, type StreamFailure } from "./chat-model";
import { CHAT_COPY } from "./copy";

type Copy = typeof CHAT_COPY.ko;
type TextKey = { [K in keyof Copy]: Copy[K] extends string ? K : never }[keyof Copy];

describe("failureMessage", () => {
  test("renders every stream failure from the current language's catalog", () => {
    const cases: [StreamFailure, TextKey][] = [
      [{ kind: "aborted" }, "stopped"],
      [{ kind: "incomplete", reason: "eof" }, "incomplete"],
      [{ kind: "incomplete", reason: "malformed" }, "malformed"],
      [{ kind: "incomplete", reason: "network" }, "network"],
      [{ kind: "error", code: "unavailable", message: "" }, "unavailable"],
      [{ kind: "error", code: "conflict", message: "" }, "conflict"],
      [{ kind: "error", code: "not_found", message: "" }, "notFound"],
      [{ kind: "error", code: "upstream_failed", message: "" }, "upstreamFailed"],
      [{ kind: "error", code: "internal", message: "" }, "internal"],
      [{ kind: "error", code: "http_error", message: "" }, "unknown"],
      [{ kind: "error", code: "unauthorized", message: "" }, "unknown"],
    ];
    for (const locale of LOCALES) {
      for (const [failure, key] of cases) expect(failureMessage(failure, locale)).toBe(CHAT_COPY[locale][key]);
    }
  });

  test("a retained failure follows a language switch and never shows the server's message", () => {
    const failure: StreamFailure = { kind: "error", code: "upstream_failed", message: "server diagnostic" };
    for (const locale of LOCALES) expect(failureMessage(failure, locale)).toBe(CHAT_COPY[locale].upstreamFailed);
  });

  test("uses the server's localized text only for codes without chat copy", () => {
    const localized = { ko: "잠시 후 다시 시도해 주세요.", en: "Try again in a moment." };
    const limited: StreamFailure = { kind: "error", code: "rate_limited", message: "server diagnostic", localized };
    for (const locale of LOCALES) expect(failureMessage(limited, locale)).toBe(localized[locale]);
    const unavailable: StreamFailure = { kind: "error", code: "unavailable", message: "server diagnostic", localized };
    for (const locale of LOCALES) expect(failureMessage(unavailable, locale)).toBe(CHAT_COPY[locale].unavailable);
  });

  test("falls back to generic copy instead of a diagnostic, blank text or an inherited key", () => {
    const failures: StreamFailure[] = [
      { kind: "error", code: "validation", message: "content: Too big" },
      { kind: "error", code: "rate_limited", message: "server diagnostic", localized: { ko: " ", en: "" } },
      { kind: "error", code: "constructor", message: "server diagnostic" },
    ];
    for (const locale of LOCALES) {
      for (const failure of failures) expect(failureMessage(failure, locale)).toBe(CHAT_COPY[locale].unknown);
    }
  });
});

describe("isDefaultThreadTitle", () => {
  test("matches only the exact server default title of either language", () => {
    expect(isDefaultThreadTitle(DEFAULT_THREAD_TITLES.ko)).toBe(true);
    expect(isDefaultThreadTitle(DEFAULT_THREAD_TITLES.en)).toBe(true);
    expect(isDefaultThreadTitle(`${DEFAULT_THREAD_TITLES.en} `)).toBe(false);
    expect(isDefaultThreadTitle("Weekly review")).toBe(false);
    expect(isDefaultThreadTitle(null)).toBe(false);
  });
});

describe("threadDateFormat", () => {
  // 01:30 on the 29th in Seoul is 09:30 on the 28th in Los Angeles.
  const instant = new Date("2026-09-28T16:30:00.000Z");
  const day = (format: Intl.DateTimeFormat) => format.formatToParts(instant).find((part) => part.type === "day")?.value;

  test("uses the viewer's time zone instead of a fixed one", () => {
    for (const locale of LOCALES) {
      expect(day(threadDateFormat(locale, "Asia/Seoul"))).toBe("29");
      expect(day(threadDateFormat(locale, "America/Los_Angeles"))).toBe("28");
    }
  });

  test("formats in the UI language", () => {
    for (const locale of LOCALES) {
      const options = threadDateFormat(locale, "America/Los_Angeles").resolvedOptions();
      expect(options.locale).toBe(INTL_LOCALE[locale]);
      expect(options.timeZone).toBe("America/Los_Angeles");
    }
  });
});
