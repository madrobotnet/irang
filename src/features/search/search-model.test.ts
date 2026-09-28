import { describe, expect, it } from "bun:test";
import { searchApiUrl, searchUrl } from "./search-model";

describe("search model", () => {
  it("encodes URL state and omits blank search requests", () => {
    expect(searchUrl("  한글 query ", "memo tag")).toBe("/search?q=%ED%95%9C%EA%B8%80+query&tag=memo+tag");
    expect(searchApiUrl("  ", "")).toBeNull();
    expect(searchApiUrl("한글", "memo")).toBe("/api/search?q=%ED%95%9C%EA%B8%80&tag=memo");
  });

});
