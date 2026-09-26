import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { homeEmptyVaultOk, homeErrorBody, homeReadyOk, type HomePageModel } from "@/lib/home/dto";
import { HomeView, type HomeViewProps } from "./HomeView";
import type { HomeInboxRowView } from "./home-inbox-rows-ui";

const note = (id: string, title: string) => ({
  id,
  title,
  updatedAt: "2026-09-23T01:02:00.000Z",
});

const preview: HomeInboxRowView[] = [
  {
    id: "i1",
    title: "받은 하나",
    summary: "요약 하나",
    source: "share",
    createdAt: "2026-09-25T01:21:00.000Z",
    url: null,
  },
];

function render(model: HomePageModel, extra: Partial<HomeViewProps> = {}) {
  return renderToStaticMarkup(
    <HomeView
      model={model}
      preview={extra.preview ?? []}
      install={extra.install ?? null}
      onRetry={() => undefined}
      onCapture={() => undefined}
      onInstall={() => undefined}
      onDismissInstall={() => undefined}
    />,
  );
}

describe("home view Desk A", () => {
  it("shows search hero, library, and synthesis when vault has notes", () => {
    const html = render(
      homeReadyOk(4, [
        note("n1", "하나"),
        note("n2", "둘"),
        note("n3", "셋"),
        note("n4", "넷"),
      ]),
      { preview },
    );
    expect(html).toContain('data-home-state="ready"');
    expect(html).toContain("무엇을 찾을까요?");
    expect(html).toContain('href="/search"');
    expect(html).toContain("⌘ K");
    expect(html).toContain("최근 라이브러리");
    expect(html).toContain("합성 · 채팅");
    expect(html).toContain("하나");
    expect(html).toContain('href="/inbox"');
    expect(html).not.toContain("Top3");
    expect(html).not.toContain("Inbox");
  });

  it("shows empty desk state when vault is empty", () => {
    const html = render(homeEmptyVaultOk(0));
    expect(html).toContain('data-home-state="empty_vault"');
    expect(html).toContain("책상이 비어 있어요");
    expect(html).toContain("첫 캡처");
    expect(html).toContain('href="/search"');
  });

  it("shows error banner with retry", () => {
    const html = render({ state: "error", error: homeErrorBody("summary_failed") });
    expect(html).toContain('data-home-state="error"');
    expect(html).toContain("불러오지 못했어요 · 다시");
  });

  it("shows skeleton while loading", () => {
    const html = render({ state: "loading" });
    expect(html).toContain('data-home-state="loading"');
    expect(html).toContain("불러오는 중");
  });

  it("shows install prompt without Vault Night copy", () => {
    const prompt = render(homeEmptyVaultOk(0), { install: "eligible" });
    expect(prompt).toContain('data-pwa-install="banner"');
    expect(prompt).toContain("책상 전체 화면");
    expect(prompt).not.toContain("Vault Night");
  });
});
