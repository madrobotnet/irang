import { describe, expect, it } from "vitest";
import { proposalFromDraft } from "@/lib/inbox/draft";
import type { InboxItem, IngestJobView } from "@/lib/inbox/types";
import { INBOX_COPY } from "./copy";
import { JEV_COPY } from "@/components/jev/copy";
import {
  cardState,
  inboxReducer,
  initialInboxModel,
  primaryState,
  visibleJobs,
  type InboxModel,
} from "./inbox-state";

const item: InboxItem = {
  id: "item-1",
  title: "제목",
  body: "요약입니다",
  source: "api",
  url: null,
  createdAt: "2026-09-22T06:00:00.000Z",
  promotedNoteId: null,
  discardedAt: null,
  suggestions: {
    tags: [{ tag: "idea", probability: 0.4 }],
    classification: { choice: "idea", probability: 0.4, confidence: 0.4 },
    judgedAt: "2026-09-22T06:00:00.000Z",
  },
};

const job: IngestJobView = {
  id: "job-1",
  title: "실패한 링크",
  detail: "forced_fail",
  createdAt: "2026-09-22T06:00:00.000Z",
};

function ready(items: InboxItem[] = [item]): InboxModel {
  return inboxReducer(initialInboxModel, { type: "load_ok", items });
}

describe("inbox copy", () => {
  it("locks the E3 and Jev strings", () => {
    expect(INBOX_COPY.empty).toBe("쌓인 캡처가 없어요");
    expect(INBOX_COPY.promote).toBe("노트화");
    expect(INBOX_COPY.discard).toBe("폐기");
    expect(INBOX_COPY.discardConfirm).toBe("Inbox에서 지울까요?");
    expect(INBOX_COPY.apply).toBe("제안 적용");
    expect(INBOX_COPY.later).toBe("나중에");
    expect(INBOX_COPY.promoteFail).toBe("승격에 실패했어요");
    expect(INBOX_COPY.ingestFail).toBe("실패");
    expect(INBOX_COPY.manualPromote).toBe("제안 없이 노트화");
    expect(JEV_COPY.uncertain).toBe("불확실");
    expect(JEV_COPY.lowConfidence).toBe("확신 낮음 · 직접 고르세요");
    expect(JEV_COPY.jevError).toBe("관련성 판단을 못 했어요");
    expect(JEV_COPY.jevErrorRetry).toBe("관련성 판단을 못 했어요. 잠시 뒤 다시");
    expect(JEV_COPY.keyMissing).toBe("검색(Jev) 키가 없어요 · 운영 키 필요");
  });
});

describe("inboxReducer", () => {
  it("moves loading to ready, empty, or error", () => {
    expect(primaryState(initialInboxModel)).toBe("loading");
    expect(primaryState(ready())).toBe("ready");
    expect(primaryState(inboxReducer(initialInboxModel, { type: "load_ok", items: [] }))).toBe(
      "empty",
    );
    expect(primaryState(inboxReducer(initialInboxModel, { type: "load_err" }))).toBe("error");
    const jev = inboxReducer(initialInboxModel, { type: "load_err", reason: "key_missing" });
    expect(primaryState(jev)).toBe("error");
    expect(jev.listError).toBe("key_missing");
  });

  it("opens a proposal without promoting, and later leaves the row", () => {
    const proposal = proposalFromDraft(item, {
      ok: true,
      title: "제목",
      summary: "요약입니다",
      tags: [{ tag: "idea", probability: 0.4 }],
      confidence: 0.4,
    });
    const opened = inboxReducer(ready(), { type: "open_proposal", proposal });
    expect(primaryState(opened)).toBe("propose_pending");
    expect(opened.promotingId).toBeNull();
    expect(opened.items).toHaveLength(1);
    expect(opened.proposal?.selectedTags).toEqual([]);

    const toggled = inboxReducer(opened, { type: "toggle_tag", tag: "idea" });
    expect(toggled.proposal?.selectedTags).toEqual(["idea"]);
    expect(toggled.items).toHaveLength(1);

    const closed = inboxReducer(toggled, { type: "close_proposal" });
    expect(closed.proposal).toBeNull();
    expect(closed.promotingId).toBeNull();
    expect(closed.items.map((row) => row.id)).toEqual(["item-1"]);
  });

  it("removes the row only after promote succeeds", () => {
    const proposal = proposalFromDraft(item, {
      ok: true,
      title: "제목",
      summary: "요약입니다",
      tags: [],
      confidence: null,
    });
    const opened = inboxReducer(ready(), { type: "open_proposal", proposal });
    const promoting = inboxReducer(opened, { type: "approve" });
    expect(primaryState(promoting)).toBe("promoting");
    expect(promoting.items).toHaveLength(1);
    expect(cardState(promoting, item)).toBe("promoting");

    const failed = inboxReducer(promoting, { type: "promote_err" });
    expect(primaryState(failed)).toBe("error");
    expect(failed.items).toHaveLength(1);
    expect(failed.proposal).not.toBeNull();

    const done = inboxReducer(promoting, { type: "promote_ok", id: "item-1" });
    expect(done.items).toEqual([]);
    expect(primaryState(done)).toBe("empty");
    expect(done.proposal).toBeNull();
  });

  it("turns a Jev promote failure into manual mode with no tags", () => {
    const proposal = proposalFromDraft(item, {
      ok: true,
      title: "제목",
      summary: "요약입니다",
      tags: [{ tag: "idea", probability: 0.4 }],
      confidence: 0.4,
    });
    const promoting = inboxReducer(
      inboxReducer(ready(), { type: "open_proposal", proposal }),
      { type: "approve" },
    );
    const manual = inboxReducer(promoting, { type: "promote_jev", reason: "key_missing" });
    expect(manual.promotingId).toBeNull();
    expect(manual.proposal?.mode).toBe("manual");
    expect(manual.proposal?.tags).toEqual([]);
    expect(manual.proposal?.selectedTags).toEqual([]);
    expect(manual.proposal?.jevError).toBe("key_missing");
    expect(manual.items).toHaveLength(1);
  });

  it("discards only after confirm", () => {
    const asked = inboxReducer(ready(), { type: "ask_discard", id: "item-1" });
    expect(asked.items).toHaveLength(1);
    const cancelled = inboxReducer(asked, { type: "cancel_discard" });
    expect(cancelled.discardId).toBeNull();
    expect(cancelled.items).toHaveLength(1);

    const gone = inboxReducer(
      inboxReducer(asked, { type: "discard_start" }),
      { type: "discard_ok", id: "item-1" },
    );
    expect(gone.items).toEqual([]);
    expect(primaryState(gone)).toBe("empty");
  });

  it("hides a failed ingest job after confirm and keeps it while the badge is open", () => {
    const model = inboxReducer(initialInboxModel, { type: "load_ok", items: [], jobs: [job] });
    expect(primaryState(model)).toBe("ingest_failed");
    expect(visibleJobs(model)).toHaveLength(1);
    const open = inboxReducer(model, { type: "toggle_ingest", id: job.id });
    expect(open.ingestOpenId).toBe(job.id);
    const noticed = inboxReducer(open, {
      type: "ingest_notice",
      jobId: job.id,
      kind: "jev_error",
    });
    expect(noticed.ingestNotice?.kind).toBe("jev_error");
    const confirmed = inboxReducer(noticed, { type: "confirm_ingest", id: job.id });
    expect(visibleJobs(confirmed)).toEqual([]);
    expect(primaryState(confirmed)).toBe("empty");
    expect(confirmed.ingestNotice).toBeNull();
  });

  it("syncs new rows without clearing an open proposal", () => {
    const proposal = proposalFromDraft(item, {
      ok: false,
      reason: "unavailable",
      title: "제목",
      summary: "요약입니다",
    });
    const opened = inboxReducer(ready(), { type: "open_proposal", proposal });
    const extra: InboxItem = { ...item, id: "item-2", title: "새 캡처", suggestions: null };
    const synced = inboxReducer(opened, {
      type: "sync_items",
      items: [item, extra],
      jobs: [job],
    });
    expect(synced.items).toHaveLength(2);
    expect(synced.jobs).toHaveLength(1);
    expect(synced.proposal?.itemId).toBe("item-1");
    expect(primaryState(synced)).toBe("propose_pending");
  });

  it("does not close the sheet while promote is in flight", () => {
    const proposal = proposalFromDraft(item, {
      ok: false,
      reason: "unavailable",
      title: "제목",
      summary: "요약입니다",
    });
    const promoting = inboxReducer(
      inboxReducer(ready(), { type: "open_proposal", proposal }),
      { type: "approve" },
    );
    const still = inboxReducer(promoting, { type: "close_proposal" });
    expect(still.proposal).not.toBeNull();
    expect(still.promotingId).toBe("item-1");
  });
});
