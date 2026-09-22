import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeTop3 } from "./HomeTop3";

describe("home chat entry", () => {
  it("links AI 채팅 to /chat", () => {
    const html = renderToStaticMarkup(<HomeTop3 />);
    expect(html).toContain('href="/chat"');
    expect(html).toContain("AI 채팅");
    expect(html).toContain('href="/search"');
    expect(html).toContain('href="/inbox"');
  });

  it("is mounted from the home page", () => {
    const source = readFileSync(fileURLToPath(new URL("../../app/(app)/page.tsx", import.meta.url)), "utf8");
    expect(source).toContain("HomeTop3");
  });
});
