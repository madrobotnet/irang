import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { homeEmptyVaultOk, homeErrorBody, homeReadyOk, type HomePageModel } from "@/lib/home/dto";
import { HomeView, type HomeViewProps } from "./HomeView";
import type { InboxPreviewRow } from "./home-model";

const note = (id: string, title: string) => ({
  id,
  title,
  updatedAt: "2026-09-23T01:02:00.000Z",
});

const preview: InboxPreviewRow[] = [
  { id: "i1", title: "받은 하나", summary: "요약 하나" },
  { id: "i2", title: "받은 둘", summary: "요약 둘" },
  { id: "i3", title: "받은 셋", summary: "" },
  { id: "i4", title: "받은 넷", summary: "넘침" },
];

function render(model: HomePageModel, extra: Partial<HomeViewProps> = {}) {
  return renderToStaticMarkup(
    <HomeView
      model={model}
      preview={extra.preview ?? []}
      install={extra.install ?? { kind: "hidden" }}
      onRetry={() => undefined}
      onCapture={() => undefined}
      onCommand={() => undefined}
      onInstall={() => undefined}
      onDismissInstall={() => undefined}
    />,
  );
}

describe("home view", () => {
  it("shows Top3, a badge, five notes, and three inbox rows when the vault is ready", () => {
    const html = render(
      homeReadyOk(4, [
        note("n1", "하나"),
        note("n2", "둘"),
        note("n3", "셋"),
        note("n4", "넷"),
        note("n5", "다섯"),
        note("n6", "여섯"),
      ]),
      { preview },
    );
    expect(html).toContain('data-home-state="ready"');
    expect(html).toContain("안녕 · 오늘");
    expect(html).toContain('href="/search"');
    expect(html).toContain('href="/inbox"');
    expect(html).toContain('href="/chat"');
    expect(html).toContain("검색");
    expect(html).toContain("Inbox");
    expect(html).toContain("AI 채팅");
    expect(html).toContain('aria-label="미처리 4"');
    expect(html).toContain(">4<");
    expect(html).toContain('href="/notes?note=n1"');
    expect(html).toContain("다섯");
    expect(html).not.toContain("여섯");
    expect(html).toContain("Inbox 미리보기");
    expect(html).toContain("받은 셋");
    expect(html).not.toContain("받은 넷");
    expect(html).not.toContain("Jev");
    expect(html).not.toContain("온라인에서만 동작해요");
  });

  it("hides the badge and the preview when inbox is empty", () => {
    const html = render(homeReadyOk(0, [note("n1", "하나")]), { preview });
    expect(html).toContain('href="/inbox"');
    expect(html).not.toContain("미처리");
    expect(html).not.toContain("Inbox 미리보기");
    expect(html).not.toContain("받은 하나");
  });

  it("shows Top3 and the first-capture empty state without recent notes", () => {
    const html = render(homeEmptyVaultOk(0));
    expect(html).toContain('data-home-state="empty_vault"');
    expect(html).toContain('href="/search"');
    expect(html).toContain('href="/chat"');
    expect(html).toContain("첫 캡처를 남겨 보세요");
    expect(html).toContain("캡처");
    expect(html).not.toContain("최근 노트");
    expect(html).not.toContain("미처리");
  });

  it("shows an error banner with retry and still offers Top3", () => {
    const html = render({ state: "error", error: homeErrorBody("summary_failed") });
    expect(html).toContain('data-home-state="error"');
    expect(html).toContain("불러오지 못했어요 · 다시");
    expect(html).toContain("다시");
    expect(html).toContain('href="/search"');
    expect(html).not.toContain("미처리");
    expect(html).not.toContain("최근 노트");
  });

  it("shows card skeletons while loading", () => {
    const html = render({ state: "loading" });
    expect(html).toContain('data-home-state="loading"');
    expect(html).toContain("불러오는 중");
    expect(html).not.toContain('href="/search"');
    expect(html).not.toContain("미처리");
  });

  it("shows a dismissible install prompt or an iOS hint without the offline sentence", () => {
    const prompt = render(homeEmptyVaultOk(0), { install: { kind: "prompt" } });
    expect(prompt).toContain("홈 화면에 추가");
    expect(prompt).toContain("나중에");
    expect(prompt).not.toContain("온라인에서만 동작해요");

    const ios = render(homeEmptyVaultOk(0), { install: { kind: "ios" } });
    expect(ios).toContain("공유 메뉴에서 홈 화면에 추가할 수 있어요");
    expect(ios).toContain("나중에");
    expect(ios).not.toContain("온라인에서만 동작해요");

    const hidden = render(homeEmptyVaultOk(0), { install: { kind: "hidden" } });
    expect(hidden).not.toContain("나중에");
    expect(hidden).not.toContain("홈 화면에 추가");
  });
});
