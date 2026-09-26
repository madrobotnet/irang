import { describe, expect, it } from "vitest";
import { indexStatusFromCounts, showsKeywordIndexBanner } from "./index-status";

describe("indexStatusFromCounts", () => {
  it("is ready when every note has an embedding", () => {
    expect(indexStatusFromCounts({ pending: 0, indexed: 3 })).toBe("ready");
  });

  it("is ready when the corpus is empty", () => {
    expect(indexStatusFromCounts({ pending: 0, indexed: 0 })).toBe("ready");
  });

  it("is indexing when some notes still lack an embedding", () => {
    expect(indexStatusFromCounts({ pending: 2, indexed: 5 })).toBe("indexing");
  });

  it("is keyword_only when FTS can run and no note is embedded", () => {
    expect(indexStatusFromCounts({ pending: 4, indexed: 0 })).toBe("keyword_only");
  });

  it("shows the keyword-first banner only for indexing and keyword_only", () => {
    expect(showsKeywordIndexBanner("ready")).toBe(false);
    expect(showsKeywordIndexBanner(undefined)).toBe(false);
    expect(showsKeywordIndexBanner(null)).toBe(false);
    expect(showsKeywordIndexBanner("indexing")).toBe(true);
    expect(showsKeywordIndexBanner("keyword_only")).toBe(true);
  });
});
