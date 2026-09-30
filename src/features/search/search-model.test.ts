import { describe, expect, it } from "bun:test";
import { copyParityIssues } from "@/lib/i18n/copy";
import { LOCALES } from "@/lib/i18n/locale";
import { SEARCH_COPY } from "./search-copy";
import { MATCH_SIGNAL_COPY, matchLabel, searchApiUrl, searchUrl } from "./search-model";

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
