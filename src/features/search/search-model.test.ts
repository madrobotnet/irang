import { describe, expect, it } from "bun:test";
import { copyParityIssues } from "@/lib/i18n/copy";
import { LOCALES } from "@/lib/i18n/locale";
import { SEARCH_COPY } from "./search-copy";
import { highlightSegments, MATCH_SIGNAL_COPY, matchLabel, searchApiUrl, searchUrl } from "./search-model";

describe("search model", () => {
  it("encodes URL state and omits blank search requests", () => {
    expect(searchUrl("  한글 query ", "memo tag")).toBe("/search?q=%ED%95%9C%EA%B8%80+query&tag=memo+tag");
    expect(searchApiUrl("  ", "")).toBeNull();
    expect(searchApiUrl("한글", "memo")).toBe("/api/search?q=%ED%95%9C%EA%B8%80&tag=memo");
  });

  it("keeps Korean and English search copy in parity", () => {
    expect(copyParityIssues(SEARCH_COPY)).toEqual([]);
  });

  it("labels the internal semantic signal as character similarity in every locale", () => {
    expect(MATCH_SIGNAL_COPY.semantic).toBe("characterSimilarity");
    for (const locale of LOCALES) {
      const { signals } = SEARCH_COPY[locale];
      expect(matchLabel({ matchedBy: ["keyword", "fuzzy", "semantic"] }, locale)).toEqual([
        signals.keyword,
        signals.similarSpelling,
        signals.characterSimilarity,
      ]);
      expect(matchLabel({ matchedBy: ["semantic"] }, locale)).toEqual([signals.characterSimilarity]);
      expect(matchLabel({ matchedBy: [] }, locale)).toEqual([]);
    }
  });

  it("keeps signal badges distinct within each locale", () => {
    for (const locale of LOCALES) {
      expect(new Set(matchLabel({ matchedBy: ["keyword", "fuzzy", "semantic"] }, locale)).size).toBe(3);
    }
  });
});

describe("highlightSegments", () => {
  it("marks a Korean term inside the text", () => {
    expect(highlightSegments("창가의 바질", "바질")).toEqual([
      { text: "창가의 ", hit: false },
      { text: "바질", hit: true },
    ]);
  });

  it("matches Latin terms case-insensitively and keeps the original casing", () => {
    expect(highlightSegments("Basil and BASIL pesto", "basil")).toEqual([
      { text: "Basil", hit: true },
      { text: " and ", hit: false },
      { text: "BASIL", hit: true },
      { text: " pesto", hit: false },
    ]);
  });

  it("treats regex characters in the query literally", () => {
    expect(highlightSegments("Notes on C++ and C", "c++")).toEqual([
      { text: "Notes on ", hit: false },
      { text: "C++", hit: true },
      { text: " and C", hit: false },
    ]);
    expect(highlightSegments("a.b axb", "a.b")).toEqual([{ text: "a.b", hit: true }, { text: " axb", hit: false }]);
  });

  it("merges overlapping and touching matches from several terms", () => {
    expect(highlightSegments("abcdef", "ab bcd")).toEqual([{ text: "abcd", hit: true }, { text: "ef", hit: false }]);
    expect(highlightSegments("abcdef", "ab cd")).toEqual([{ text: "abcd", hit: true }, { text: "ef", hit: false }]);
    expect(highlightSegments("aaaa", "aa")).toEqual([{ text: "aaaa", hit: true }]);
  });

  it("returns one plain segment for a blank query or no match", () => {
    expect(highlightSegments("창가의 바질", "  ")).toEqual([{ text: "창가의 바질", hit: false }]);
    expect(highlightSegments("창가의 바질", "토마토")).toEqual([{ text: "창가의 바질", hit: false }]);
  });
});
