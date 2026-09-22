import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { InboxItem } from "@/lib/inbox/types";
import { manualProposal, proposalFromDraft } from "@/lib/inbox/draft";
import { draftFromItem } from "@/lib/inbox/draft";
import { InboxView, type InboxViewProps } from "./InboxView";
import { inboxReducer, initialInboxModel } from "./inbox-state";

const item: InboxItem = {
  id: "item-1",
  title: "읽은 기사",
  body: "첫 줄 요약입니다. 둘째 줄도 있고 셋째 줄은 잘려야 합니다.",
  source: "url",
  url: "https://example.com/a",
  createdAt: "2026-09-22T06:14:00.000Z",
  promotedNoteId: null,
  discardedAt: null,
  suggestions: {
    tags: [{ tag: "reference", probability: 0.33 }],
    classification: { choice: "reference", probability: 0.33, confidence: 0.33 },
    judgedAt: "2026-09-22T06:14:00.000Z",
  },
};

function noop() {}

function view(model: InboxViewProps["model"], patch: Partial<InboxViewProps> = {}) {
  const props: InboxViewProps = {
    model,
    onCapture: noop,
    onReload: noop,
    onPromote: noop,
    onAskDiscard: noop,
    onToggleIngest: noop,
    onRetryIngest: noop,
    onConfirmIngest: noop,
    onToggleTag: noop,
    onApprove: noop,
    onLater: noop,
    onRetryJev: noop,
    onConfirmDiscard: noop,
    onCancelDiscard: noop,
    ...patch,
  };
  return renderToStaticMarkup(<InboxView {...props} />);
}

describe("InboxView", () => {
  it("renders a loading skeleton", () => {
    const html = view(initialInboxModel);
    expect(html).toContain('data-inbox-state="loading"');
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("노트화");
  });

  it("renders the empty state", () => {
    const model = inboxReducer(initialInboxModel, { type: "load_ok", items: [] });
    const html = view(model);
    expect(html).toContain('data-empty-state="true"');
    expect(html).toContain("쌓인 캡처가 없어요");
    expect(html).toContain("캡처");
    expect(html).toContain("Inbox");
    expect(html).toContain("(0)");
  });

  it("renders a card with title, summary, source, and time", () => {
    const model = inboxReducer(initialInboxModel, { type: "load_ok", items: [item] });
    const html = view(model);
    expect(html).toContain("읽은 기사");
    expect(html).toContain("첫 줄 요약입니다.");
    expect(html).toContain("웹");
    expect(html).toContain("노트화");
    expect(html).toContain("폐기");
    expect(html).toContain("2026-09-22T06:14:00.000Z");
    expect(html).toContain("9월 22일");
    expect(html).toContain("(1)");
  });

  it("shows suggestion chips and the uncertain label before apply", () => {
    const proposal = proposalFromDraft(item, draftFromItem(item));
    const model = inboxReducer(
      inboxReducer(initialInboxModel, { type: "load_ok", items: [item] }),
      { type: "open_proposal", proposal },
    );
    const html = view(model);
    expect(html).toContain('data-inbox-state="propose_pending"');
    expect(html).toContain("읽은 기사");
    expect(html).toContain("첫 줄 요약입니다.");
    expect(html).toContain("reference");
    expect(html).toContain("불확실");
    expect(html).toContain("확신 낮음 · 직접 고르세요");
    expect(html).toContain("제안 적용");
    expect(html).toContain("나중에");
    expect(html).not.toContain("건너뛰기");
    expect(html).toContain('aria-pressed="false"');
    expect(html).not.toContain("<input");
    expect(html).not.toContain("<textarea");
  });

  it("shows manual promote and a Jev error banner without chips", () => {
    const proposal = manualProposal(item, "jev_error");
    const model = inboxReducer(
      inboxReducer(initialInboxModel, { type: "load_ok", items: [item] }),
      { type: "open_proposal", proposal },
    );
    const html = view(model);
    expect(html).toContain("관련성 판단을 못 했어요. 잠시 뒤 다시");
    expect(html).toContain("제안 없이 노트화");
    expect(html).not.toContain("reference");
    expect(html).toContain("읽은 기사");
    expect(html).not.toContain("제안 적용");
  });

  it("shows the missing-key banner", () => {
    const proposal = manualProposal({ ...item, suggestions: null }, "key_missing");
    const model = inboxReducer(
      inboxReducer(initialInboxModel, { type: "load_ok", items: [item] }),
      { type: "open_proposal", proposal },
    );
    const html = view(model);
    expect(html).toContain("검색(Jev) 키가 없어요 · 운영 키 필요");
    expect(html).not.toContain("제안 적용");
  });

  it("asks before discard", () => {
    const model = inboxReducer(
      inboxReducer(initialInboxModel, { type: "load_ok", items: [item] }),
      { type: "ask_discard", id: item.id },
    );
    const html = view(model);
    expect(html).toContain("Inbox에서 지울까요?");
    expect(html).toContain("취소");
  });

  it("shows the ingest badge and retry/confirm once opened", () => {
    const loaded = inboxReducer(initialInboxModel, {
      type: "load_ok",
      items: [],
      jobs: [
        {
          id: "job-1",
          title: "실패한 기사",
          detail: "forced_fail",
          createdAt: "2026-09-22T06:14:00.000Z",
        },
      ],
    });
    const closed = view(loaded);
    expect(closed).toContain('data-inbox-state="ingest_failed"');
    expect(closed).toContain("실패");
    expect(closed).toContain('aria-expanded="false"');
    expect(closed).toContain("실패한 기사");
    expect(closed).not.toContain("노트화");

    const opened = inboxReducer(loaded, { type: "toggle_ingest", id: "job-1" });
    const html = view(opened);
    expect(html).toContain('data-job-state="ingest_failed"');
    expect(html).toContain("다시");
    expect(html).toContain("확인");
  });

  it("shows a Jev banner on a failed ingest retry and keeps the job", () => {
    const loaded = inboxReducer(initialInboxModel, {
      type: "load_ok",
      items: [],
      jobs: [
        {
          id: "job-1",
          title: "실패한 기사",
          detail: "forced_fail",
          createdAt: "2026-09-22T06:14:00.000Z",
        },
      ],
    });
    const noticed = inboxReducer(loaded, {
      type: "ingest_notice",
      jobId: "job-1",
      kind: "key_missing",
    });
    const html = view(noticed);
    expect(html).toContain("검색(Jev) 키가 없어요 · 운영 키 필요");
    expect(html).toContain("실패한 기사");
    expect(html).not.toContain("reference");
  });

  it("shows promote failure copy", () => {
    const proposal = proposalFromDraft(item, draftFromItem(item));
    const model = inboxReducer(
      inboxReducer(
        inboxReducer(initialInboxModel, { type: "load_ok", items: [item] }),
        { type: "open_proposal", proposal },
      ),
      { type: "promote_err" },
    );
    const html = view(model);
    expect(html).toContain("승격에 실패했어요");
    expect(html).toContain('data-inbox-state="error"');
  });

  it("shows a list load error and a Jev list error", () => {
    const model = inboxReducer(initialInboxModel, { type: "load_err" });
    const html = view(model);
    expect(html).toContain("연결에 실패했어요 · 다시");
    expect(html).toContain('data-inbox-state="error"');

    const jev = inboxReducer(initialInboxModel, { type: "load_err", reason: "jev_error" });
    expect(view(jev)).toContain("관련성 판단을 못 했어요. 잠시 뒤 다시");
    expect(view(jev)).not.toContain("쌓인 캡처가 없어요");
  });
});
