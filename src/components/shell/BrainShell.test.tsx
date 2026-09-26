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

describe("BrainShell mobile chrome", () => {
  it("shows MobileTopChrome on home without a back button or tab bar", () => {
    const html = render("/");
    expect(html).toContain('data-mobile-chrome="top"');
    expect(html).toContain('data-mobile-top-chrome');
    expect(html).toContain('aria-label="메뉴"');
    expect(html).toContain("⋯");
    expect(html).toContain('aria-label="하단 도구"');
    expect(html).toContain("노트 검색");
    expect(html).toContain("캡처");
    expect(html).toContain('aria-label="앱 도구"');
    expect(html).toContain("세컨드 브레인");
    expect(html).not.toContain("data-mobile-stack-header");
    expect(html).not.toContain('aria-label="이전"');
    expect(html).not.toContain('role="tablist"');
    expect(html).not.toContain("탭 바");
  });

  it("shows MobileStackHeader with 이전 on Inbox", () => {
    const html = render("/inbox");
    expect(html).toContain('data-mobile-chrome="stack"');
    expect(html).toContain('data-mobile-stack-header');
    expect(html).toContain('aria-label="이전"');
    expect(html).toContain("이전");
    expect(html).toContain("Inbox");
    expect(html).toContain('aria-label="메뉴"');
    expect(html).toContain('aria-label="하단 도구"');
    expect(html).not.toContain("data-mobile-top-chrome");
  });

  it("shows stack chrome on notes, search, and settings", () => {
    expect(render("/notes")).toContain(">노트<");
    expect(render("/search")).toContain(">검색<");
    expect(render("/settings")).toContain(">설정<");
    expect(render("/notes")).toContain('aria-label="이전"');
  });

  it("shows MobileTopChrome on AI 채팅 and hides the tool row", () => {
    const html = render("/chat");
    expect(html).toContain('data-mobile-chrome="top"');
    expect(html).toContain("data-mobile-top-chrome");
    expect(html).toContain('data-mobile-tool="off"');
    expect(html).not.toContain('aria-label="하단 도구"');
  });

  it("does not add MobileTopChrome or MobileStackHeader on /graph", () => {
    const html = render("/graph");
    expect(html).toContain('data-mobile-chrome="none"');
    expect(html).not.toContain("data-mobile-top-chrome");
    expect(html).not.toContain("data-mobile-stack-header");
  });

  it("keeps the desktop instrument destinations in source", () => {
    const source = readFileSync(fileURLToPath(new URL("./BrainShell.tsx", import.meta.url)), "utf8");
    expect(source).toContain('href="/notes"');
    expect(source).toContain('href="/graph"');
    expect(source).toContain('href="/settings"');
    expect(source).toContain('action="/api/auth/logout"');
    expect(source).not.toContain("tab bar");
    expect(source).not.toContain("TabBar");
    const css = readFileSync(
      fileURLToPath(new URL("./BrainShell.module.css", import.meta.url)),
      "utf8",
    );
    expect(css).toContain(".instrument {\n  display: none;");
    expect(css).toContain("@media (min-width: 1024px) {\n  .instrument {\n    display: flex;");
  });
});
