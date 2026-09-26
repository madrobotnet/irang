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
  {
    id: "i2",
    title: "받은 둘",
    summary: "요약 둘",
    source: "file",
    createdAt: "2026-09-25T00:47:00.000Z",
    url: null,
  },
  {
    id: "i3",
    title: "받은 셋",
    summary: "",
    source: "web",
    createdAt: "2026-09-24T21:05:00.000Z",
    url: null,
  },
  {
    id: "i4",
    title: "받은 넷",
    summary: "넘침",
    source: "web",
    createdAt: "2026-09-24T21:05:00.000Z",
    url: null,
  },
];

function render(model: HomePageModel, extra: Partial<HomeViewProps> = {}) {
  return renderToStaticMarkup(
    <HomeView
      model={model}
      preview={extra.preview ?? []}
      install={extra.install ?? { kind: "hidden" }}
      onRetry={() => undefined}
      onCapture={() => undefined}
      onInstall={() => undefined}
      onDismissInstall={() => undefined}
    />,
  );
}

describe("home view", () => {
  it("shows Top3, inbox hero, three preview rows, and organize when inbox has work", () => {
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
    expect(html).toContain('href="/search"');
    expect(html).toContain('href="/inbox"');
    expect(html).toContain('href="/chat"');
    expect(html).toContain("검색");
    expect(html).toContain("Inbox");
    expect(html).toContain("AI 채팅");
    expect(html).toContain('aria-label="미처리 4"');
    expect(html).toContain("미처리");
    expect(html).toContain("정리");
    expect(html).toContain("받은 셋");
    expect(html).not.toContain("받은 넷");
    expect(html).toContain("이어서");
    expect(html).toContain("더 보기");
    expect(html).toContain('href="/notes"');
    expect(html).not.toContain('href="/notes?note=');
    expect(html).toContain("클립");
    expect(html).not.toContain("최근 노트");
    expect(html).not.toContain("⌘K");
    expect(html).not.toContain("Jev");
    expect(html).not.toContain("온라인에서만 동작해요");
  });

  it("hides the badge and shows empty inbox copy when count is zero but notes exist", () => {
    const html = render(homeReadyOk(0, [note("n1", "하나")]), { preview });
    expect(html).toContain('href="/inbox"');
    expect(html).not.toContain("미처리");
    expect(html).toContain("쌓인 캡처가 없어요");
    expect(html).toContain("캡처");
    expect(html).not.toContain("받은 하나");
  });

  it("shows Top3 and empty vault copy without continue line", () => {
    const html = render(homeEmptyVaultOk(0));
    expect(html).toContain('data-home-state="empty_vault"');
    expect(html).toContain('href="/search"');
    expect(html).toContain('href="/chat"');
    expect(html).toContain("쌓인 캡처가 없어요");
    expect(html).toContain("캡처");
    expect(html).not.toContain("이어서");
    expect(html).not.toContain("미처리");
  });

  it("shows an error banner with retry and still offers Top3", () => {
    const html = render({ state: "error", error: homeErrorBody("summary_failed") });
    expect(html).toContain('data-home-state="error"');
    expect(html).toContain("불러오지 못했어요 · 다시");
    expect(html).toContain("다시");
    expect(html).toContain('href="/search"');
    expect(html).not.toContain("미처리");
    expect(html).not.toContain(" · 0");
  });

  it("shows skeletons while loading without Top3 links", () => {
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
    expect(hidden).not.toContain("홈 화면에 추가");
    expect(hidden).not.toContain('aria-label="홈 화면에 추가"');
  });
});
