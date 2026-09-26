import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MobileStackHeader } from "./MobileStackHeader";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: () => undefined, replace: () => undefined }),
}));

describe("MobileStackHeader", () => {
  it("uses the Inbox mock grid: 이전, title, 메뉴", () => {
    const html = renderToStaticMarkup(
      <MobileStackHeader title="Inbox" menuOpen={false} onToggleMenu={() => undefined} />,
    );
    expect(html).toContain('aria-label="스택 헤더"');
    expect(html).toContain('data-mobile-stack-header');
    expect(html).toContain('aria-label="이전"');
    expect(html).toContain("이전");
    expect(html).toContain("Inbox");
    expect(html).toContain('aria-label="메뉴"');
    expect(html).toContain("⋯");
    expect(html).toContain("‹");
  });
});
