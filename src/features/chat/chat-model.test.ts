import { describe, expect, test } from "bun:test";
import { LOCALES } from "@/lib/i18n/locale";
import type { Citation } from "@/lib/types";
import { DEFAULT_THREAD_TITLES, citedIndices, failureMessage, isDefaultThreadTitle, partitionCitations, type StreamFailure } from "./chat-model";
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

describe("citedIndices", () => {
  const sorted = (answer: string) => [...citedIndices(answer)].sort((a, b) => a - b);

  test("reads single, repeated, listed and ranged markers", () => {
    expect(sorted("성산일출봉은 아침에 가요[3]. 우도는 오후에 가요 [1][3].")).toEqual([1, 3]);
    expect(sorted("Both notes agree [2, 5].")).toEqual([2, 5]);
    expect(sorted("See [2-4] and [6–7].")).toEqual([2, 3, 4, 6, 7]);
    expect(sorted("[출처 2]와 [Source 4]")).toEqual([2, 4]);
  });

  test("ignores code, Markdown link text and implausible ranges", () => {
    expect(sorted("Use `items[0]` here.\n\n```ts\nconst a = list[2];\n```\nDone [1].")).toEqual([1]);
    expect(sorted("Read [3](https://example.com) first.")).toEqual([]);
    expect(sorted("Years [1-999] are not a citation.")).toEqual([]);
    expect(sorted("No markers at all.")).toEqual([]);
  });
});

describe("partitionCitations", () => {
  const source = (index: number): Citation => ({ index, noteId: `note-${index}`, title: `Note ${index}`, excerpt: "" });
  const sources = [1, 2, 3, 4, 5].map(source);
  const indices = (list: Citation[]) => list.map((citation) => citation.index);

  test("puts cited sources first and keeps the rest as also retrieved, both in source order", () => {
    const { cited, others } = partitionCitations("우도는 오후[3], 성산은 아침[1].", sources);
    expect(indices(cited)).toEqual([1, 3]);
    expect(indices(others)).toEqual([2, 4, 5]);
  });

  test("claims nothing when the answer cites none of the returned sources", () => {
    for (const answer of ["An answer without markers.", "Only an unknown source [9]."]) {
      const { cited, others } = partitionCitations(answer, sources);
      expect(indices(cited)).toEqual([1, 2, 3, 4, 5]);
      expect(others).toEqual([]);
    }
  });
});
