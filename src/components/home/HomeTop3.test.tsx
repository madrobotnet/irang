import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeTop3 } from "./HomeTop3";

describe("HomeTop3 legacy component", () => {
  it("still links search, inbox, and chat for any remaining mounts", () => {
    const html = renderToStaticMarkup(<HomeTop3 />);
    expect(html).toContain('href="/chat"');
    expect(html).toContain('href="/search"');
    expect(html).toContain('href="/inbox"');
  });

  it("is not mounted on the Desk A home view", () => {
    const view = readFileSync(fileURLToPath(new URL("./HomeView.tsx", import.meta.url)), "utf8");
    expect(view).not.toContain("<HomeTop3");
    expect(view).toContain("heroTitle");
  });
});
