import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { SEARCH_COPY } from "@/components/search/copy";
import SearchPage from "./page";

describe("search route", () => {
  it("does not mount PlaceholderPage", () => {
    const source = readFileSync(fileURLToPath(new URL("./page.tsx", import.meta.url)), "utf8");
    expect(source).not.toContain("PlaceholderPage");
    expect(source).toContain("SearchScreen");
  });

  it("renders the search screen instead of the P1 placeholder", () => {
    const html = renderToStaticMarkup(<SearchPage />);
    expect(html).toContain('data-search-state="idle"');
    expect(html).toContain("검색");
    expect(html).toContain("data-desk-command-bar");
    expect(html).toContain(SEARCH_COPY.placeholder.slice(0, 8));
    expect(html).not.toContain("P1 준비 중");
  });
});
