import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MoreSheet } from "./MoreSheet";

describe("MoreSheet", () => {
  it("renders nothing when closed", () => {
    expect(renderToStaticMarkup(<MoreSheet open={false} onClose={() => undefined} />)).toBe("");
  });

  it("renders the bottom-sheet rows, Inbox through 설정, and logout POST", () => {
    const html = renderToStaticMarkup(<MoreSheet open onClose={() => undefined} />);
    expect(html).toContain('data-more-sheet="open"');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-label="메뉴"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-label="메뉴 닫기"');
    expect(html).toContain("Inbox");
    expect(html).toContain("노트");
    expect(html).toContain("그래프");
    expect(html).toContain("설정");
    expect(html).toContain("나가기");
    expect(html).toContain('href="/inbox"');
    expect(html).toContain('href="/notes"');
    expect(html).toContain('href="/graph"');
    expect(html).toContain('href="/settings"');
    expect(html).toContain('action="/api/auth/logout"');
    expect(html).toContain('method="post"');
    expect(html).not.toContain("탭");
    expect(html).not.toContain("tab bar");
  });
});
