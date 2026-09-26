import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { AppProviders } from "./AppProviders";
import { BrainShell } from "./BrainShell";

const nav = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ back: () => undefined, replace: () => undefined }),
  useSearchParams: () => new URLSearchParams(),
}));

function render(pathname: string) {
  nav.pathname = pathname;
  return renderToStaticMarkup(
    <AppProviders>
      <BrainShell>
        <div>본문</div>
      </BrainShell>
    </AppProviders>,
  );
}

describe("BrainShell Desk A chrome", () => {
  it("renders charcoal rail with five destinations on desktop markup", () => {
    const html = render("/");
    expect(html).toContain('data-desk-shell="a"');
    expect(html).toContain('aria-label="유틸 레일"');
    expect(html).toContain(">홈<");
    expect(html).toContain(">검색<");
    expect(html).toContain(">수집<");
    expect(html).toContain(">채팅<");
    expect(html).toContain(">관계<");
    expect(html).toContain('href="/graph"');
    expect(html).toContain('href="/settings"');
    expect(html).not.toContain("세컨드 브레인");
    expect(html).not.toContain('aria-label="메뉴"');
    expect(html).not.toContain("Top3");
  });

  it("renders mobile dock with search FAB and no hamburger", () => {
    const html = render("/search");
    expect(html).toContain('aria-label="하단 도크"');
    expect(html).toContain('aria-label="검색"');
    expect(html).not.toContain("⋯");
    expect(html).not.toContain("data-mobile-chrome");
  });

  it("marks graph layout mode on /graph", () => {
    const html = render("/graph");
    expect(html).toContain('data-graph="on"');
  });

  it("wires graph in the rail source", () => {
    const source = readFileSync(fileURLToPath(new URL("./desk-nav.ts", import.meta.url)), "utf8");
    expect(source).toContain('label: "관계"');
    expect(source).toContain('href: "/graph"');
    const css = readFileSync(
      fileURLToPath(new URL("./DeskRail.module.css", import.meta.url)),
      "utf8",
    );
    expect(css).toContain("var(--rail-w)");
  });
});
