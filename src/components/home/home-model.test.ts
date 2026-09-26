import { describe, expect, it } from "vitest";
import {
  homeSwipeHref,
  inboxBadgeCount,
  installOffer,
  offlineBannerMessage,
  pageModelFromBody,
  parseHomeSummary,
  previewRows,
  showInboxPreview,
  visibleRecentNotes,
} from "./home-model";
import { homeEmptyVaultOk, homeReadyOk, type RecentNoteListItemDto } from "@/lib/home/dto";

const note = (id: string, title: string): RecentNoteListItemDto => ({
  id,
  title,
  updatedAt: "2026-09-23T01:02:00.000Z",
});

describe("home summary parse", () => {
  it("keeps a ready vault with its inbox count and notes", () => {
    const summary = parseHomeSummary({
      ok: true,
      state: "ready",
      inboxBadge: { count: 4 },
      recentNotes: [note("n1", "아침")],
    });
    expect(summary).toEqual(homeReadyOk(4, [note("n1", "아침")]));
  });

  it("rejects an empty recent list instead of calling the vault empty", () => {
    expect(
      parseHomeSummary({
        ok: true,
        state: "ready",
        inboxBadge: { count: 0 },
        recentNotes: [],
      }),
    ).toBeNull();
    expect(
      pageModelFromBody({
        ok: true,
        state: "ready",
        inboxBadge: { count: 0 },
        recentNotes: [],
      }),
    ).toEqual({ state: "error", error: { ok: false, code: "summary_failed" } });
  });

  it("reads an empty vault without inventing recent notes", () => {
    const summary = parseHomeSummary({
      ok: true,
      state: "empty_vault",
      inboxBadge: { count: 0 },
    });
    expect(summary).toEqual(homeEmptyVaultOk(0));
    expect(summary).not.toHaveProperty("recentNotes");
  });

  it("fails closed when an empty vault also carries notes", () => {
    expect(
      parseHomeSummary({
        ok: true,
        state: "empty_vault",
        inboxBadge: { count: 1 },
        recentNotes: [note("n1", "아침")],
      }),
    ).toBeNull();
  });

  it("keeps unauthorized and summary failures free of a badge", () => {
    expect(
      pageModelFromBody({ ok: false, authenticated: false, code: "unauthorized" }),
    ).toEqual({
      state: "error",
      error: { ok: false, code: "unauthorized" },
    });
    const failed = pageModelFromBody({ ok: false, code: "summary_failed" });
    expect(failed).toEqual({ state: "error", error: { ok: false, code: "summary_failed" } });
    expect(inboxBadgeCount(failed)).toBeNull();
    expect(pageModelFromBody({ ok: false, code: "nope" })).toEqual({
      state: "error",
      error: { ok: false, code: "summary_failed" },
    });
  });
});

describe("home display rules", () => {
  it("shows five recent notes and three inbox rows", () => {
    const notes = ["하나", "둘", "셋", "넷", "다섯", "여섯"].map((title, index) =>
      note(`n${index}`, title),
    );
    expect(visibleRecentNotes(notes).map((item) => item.title)).toEqual([
      "하나",
      "둘",
      "셋",
      "넷",
      "다섯",
    ]);
    expect(
      previewRows([
        { id: "a", title: "  ", body: "본문" },
        { id: "b", title: "둘", body: "  " },
        { id: "c", title: "셋", body: "세 줄" },
        { id: "d", title: "넷", body: "숨김" },
      ]),
    ).toEqual([
      { id: "a", title: "캡처", summary: "본문" },
      { id: "b", title: "둘", summary: "" },
      { id: "c", title: "셋", summary: "세 줄" },
    ]);
  });

  it("hides the inbox badge and preview at zero and shows them when work is waiting", () => {
    const ready = homeReadyOk(0, [note("n1", "아침")]);
    const waiting = homeReadyOk(2, [note("n1", "아침")]);
    const row = { id: "i1", title: "받은 것", summary: "요약" };
    expect(inboxBadgeCount(ready)).toBe(0);
    expect(showInboxPreview(ready, [row])).toBe(false);
    expect(inboxBadgeCount(waiting)).toBe(2);
    expect(showInboxPreview(waiting, [row])).toBe(true);
    expect(showInboxPreview(waiting, [])).toBe(false);
    expect(showInboxPreview({ state: "loading" }, [row])).toBe(false);
  });

  it("sends home swipes to chat or search and ignores short and vertical moves", () => {
    expect(homeSwipeHref(-80, 10)).toBe("/chat");
    expect(homeSwipeHref(80, 0)).toBe("/search");
    expect(homeSwipeHref(-40, 0)).toBeNull();
    expect(homeSwipeHref(-90, 120)).toBeNull();
  });

  it("offers install once, as a prompt or an iOS hint, and stays quiet otherwise", () => {
    expect(
      installOffer({ dismissed: false, standalone: false, ios: false, hasPrompt: true }),
    ).toEqual({ kind: "prompt" });
    expect(
      installOffer({ dismissed: false, standalone: false, ios: true, hasPrompt: true }),
    ).toEqual({ kind: "prompt" });
    expect(
      installOffer({ dismissed: false, standalone: false, ios: true, hasPrompt: false }),
    ).toEqual({ kind: "ios" });
    expect(
      installOffer({ dismissed: true, standalone: false, ios: true, hasPrompt: true }),
    ).toEqual({ kind: "hidden" });
    expect(
      installOffer({ dismissed: false, standalone: true, ios: false, hasPrompt: true }),
    ).toEqual({ kind: "hidden" });
    expect(
      installOffer({ dismissed: false, standalone: false, ios: false, hasPrompt: false }),
    ).toEqual({ kind: "hidden" });
  });

  it("uses the online-only sentence only while offline", () => {
    expect(offlineBannerMessage(false)).toBe("온라인에서만 동작해요");
    expect(offlineBannerMessage(true)).toBeNull();
  });
});
