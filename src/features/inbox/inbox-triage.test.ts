import { describe, expect, test } from "bun:test";
import type { InboxItem } from "@/lib/types";
import {
  excerpt,
  mergeTags,
  moveSelection,
  neighbourAfterRemoval,
  replaceItem,
  resolveTriageKey,
  stripUrlStatus,
  suggestionView,
  syncTriageDraft,
  urlStatus,
  withItem,
  withoutItem,
} from "./inbox-triage";

const key = (k: string, extra: Partial<Parameters<typeof resolveTriageKey>[0]> = {}) =>
  resolveTriageKey({ key: k, editable: false, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...extra });

const item = (id: string, over: Partial<InboxItem> = {}): InboxItem => ({
  id,
  title: `제목 ${id}`,
  body: `본문 ${id}`,
  source: "web",
  url: null,
  createdAt: "2026-09-27T00:00:00.000Z",
  suggestions: null,
  ...over,
});

describe("resolveTriageKey", () => {
  test("maps vim and arrow keys to list movement and actions", () => {
    expect(key("j")).toBe("next");
    expect(key("ArrowDown")).toBe("next");
    expect(key("K")).toBe("prev");
    expect(key("Home")).toBe("first");
    expect(key("End")).toBe("last");
    expect(key("Enter")).toBe("open");
    expect(key("p")).toBe("promote");
    expect(key("d")).toBe("discard");
    expect(key("#")).toBe("discard");
    expect(key("Escape")).toBe("clear");
    expect(key("x")).toBeNull();
  });

  test("never intercepts typing or modifier chords", () => {
    expect(key("j", { editable: true })).toBeNull();
    expect(key("Enter", { editable: true })).toBeNull();
    expect(key("p", { ctrlKey: true })).toBeNull();
    expect(key("k", { metaKey: true })).toBeNull();
    expect(key("d", { altKey: true })).toBeNull();
    expect(key("D", { shiftKey: true })).toBeNull();
    expect(key("P", { shiftKey: true })).toBeNull();
  });
});

describe("selection movement", () => {
  const items = [item("a"), item("b"), item("c")];

  test("moves within bounds and starts from the ends when nothing is selected", () => {
    expect(moveSelection(items, null, 1)).toBe("a");
    expect(moveSelection(items, null, -1)).toBe("c");
    expect(moveSelection(items, "a", 1)).toBe("b");
    expect(moveSelection(items, "c", 1)).toBe("c");
    expect(moveSelection(items, "a", -1)).toBe("a");
    expect(moveSelection(items, "b", 99)).toBe("c");
    expect(moveSelection([], "a", 1)).toBeNull();
  });

  test("picks the next neighbour after a removal, then the previous, then none", () => {
    expect(neighbourAfterRemoval(items, "a")).toBe("b");
    expect(neighbourAfterRemoval(items, "c")).toBe("b");
    expect(neighbourAfterRemoval([item("only")], "only")).toBeNull();
    expect(neighbourAfterRemoval(items, "zzz")).toBeNull();
  });
});

describe("cache helpers", () => {
  test("keep count in step with items", () => {
    const data = { items: [item("a"), item("b")], count: 2 };
    expect(withoutItem(data, "a")).toEqual({ items: [item("b")], count: 1 });
    expect(withItem(data, item("c"))).toEqual({ items: [item("c"), item("a"), item("b")], count: 3 });
    expect(withItem(data, item("a", { title: "새 제목" })).items.map((i) => i.title)).toEqual(["새 제목", "제목 b"]);
    expect(replaceItem(data, item("b", { title: "바뀜" })).items[1]?.title).toBe("바뀜");
    expect(withoutItem(undefined, "a")).toEqual({ items: [], count: 0 });
  });
});

describe("draft refresh", () => {
  test("adopts fresh server fields without replacing dirty user fields", () => {
    const pristine = { title: "처음", body: "대기", sourceTitle: "처음", sourceBody: "대기", titleDirty: false, bodyDirty: false };
    expect(syncTriageDraft(pristine, "서버 제목", "가져온 본문")).toMatchObject({ title: "서버 제목", body: "가져온 본문" });

    const dirty = { ...pristine, title: "내 제목", body: "내 본문", titleDirty: true, bodyDirty: true };
    expect(syncTriageDraft(dirty, "서버 제목", "가져온 본문")).toEqual({
      ...dirty,
      sourceTitle: "서버 제목",
      sourceBody: "가져온 본문",
    });
  });
});

describe("mergeTags", () => {
  test("normalises, dedupes and keeps manual tags first", () => {
    expect(mergeTags(" #Idea, 학습 ,idea\n", ["Reference", "학습"])).toEqual(["idea", "학습", "reference"]);
    expect(mergeTags("", [])).toEqual([]);
  });
});

describe("suggestionView", () => {
  test("distinguishes not-yet, unavailable, failed and ready", () => {
    expect(suggestionView(null)).toEqual({ kind: "pending" });
    expect(suggestionView({ status: "unavailable", tags: [], kind: null, duplicateOf: null })).toEqual({ kind: "unavailable" });
    expect(suggestionView({ status: "failed", tags: [], kind: null, duplicateOf: null })).toEqual({ kind: "failed" });
    const ready = { status: "ready" as const, tags: [{ tag: "idea", probability: 0.9 }], kind: null, duplicateOf: null };
    expect(suggestionView(ready)).toEqual({ kind: "ready", suggestions: ready });
  });
});

describe("url status lines", () => {
  test("are detected and stripped from the body shown to the user", () => {
    const pending = "메모\n\n> URL 내용을 가져오는 중입니다.";
    expect(urlStatus(pending)).toBe("pending");
    expect(stripUrlStatus(pending)).toBe("메모");
    const failed = "> URL 내용을 가져오지 못했습니다. 원문 링크는 보존되었습니다.";
    expect(urlStatus(failed)).toBe("failed");
    expect(stripUrlStatus(failed)).toBe("");
    expect(urlStatus("평범한 본문")).toBeNull();
    expect(excerpt("첫 줄\n둘째 줄  셋째", 8)).toBe("첫 줄 둘째 …");
    expect(excerpt("짧다")).toBe("짧다");
  });
});
