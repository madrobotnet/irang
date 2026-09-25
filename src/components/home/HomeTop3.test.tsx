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
    const page = readFileSync(fileURLToPath(new URL("../../app/(app)/page.tsx", import.meta.url)), "utf8");
    const screen = readFileSync(fileURLToPath(new URL("./HomeScreen.tsx", import.meta.url)), "utf8");
    const view = readFileSync(fileURLToPath(new URL("./HomeView.tsx", import.meta.url)), "utf8");
    expect(page).toContain("<HomeScreen />");
    expect(screen).toContain("<HomeView");
    expect(view).toContain("<HomeTop3");
  });

  it("shows the inbox count and hides a zero badge", () => {
    const withCount = renderToStaticMarkup(<HomeTop3 inboxCount={7} />);
    const clear = renderToStaticMarkup(<HomeTop3 inboxCount={0} />);
    expect(withCount).toContain('aria-label="미처리 7"');
    expect(withCount).toContain(">7<");
    expect(clear).toContain('href="/inbox"');
    expect(clear).not.toContain("미처리");
  });
});
