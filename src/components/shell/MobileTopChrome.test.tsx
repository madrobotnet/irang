import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MobileTopChrome } from "./MobileTopChrome";

describe("MobileTopChrome", () => {
  it("shows the brand mark and a 44px 메뉴 button without replacing Top3", () => {
    const html = renderToStaticMarkup(
      <MobileTopChrome menuOpen={false} onToggleMenu={() => undefined} />,
    );
    expect(html).toContain('aria-label="모바일 상단"');
    expect(html).toContain('data-mobile-top-chrome');
    expect(html).toContain('aria-label="메뉴"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("⋯");
    expect(html).not.toContain("검색");
    expect(html).not.toContain("AI 채팅");
    expect(html).not.toContain("이전");
  });

  it("sets aria-expanded when the sheet is open", () => {
    const html = renderToStaticMarkup(
      <MobileTopChrome menuOpen onToggleMenu={() => undefined} />,
    );
    expect(html).toContain('aria-expanded="true"');
  });
});
