import { describe, expect, it } from "vitest";
import { chatContextLimitSignal } from "@/lib/chat/dto";
import { interpretTurnBody, splitCitationMarks } from "./parse";

const route = {
  type: "choice",
  choice: "answer",
  confidence: 0.74,
  probabilities: { answer: 0.86, propose_edit: 0.1, none: 0.04 },
};

const relevance = {
  type: "score",
  score: 2.1,
  legend: { "2": "답에 가깝다" },
  probabilities: { "2": 0.8, "1": 0.2 },
  confidence: 0.7,
};

function turn(patch: Record<string, unknown> = {}) {
  return {
    ok: true,
    threadId: "thread-1",
    userMessage: {
      id: "user-1",
      threadId: "thread-1",
      role: "user",
      body: "소유권은?",
      createdAt: "2026-09-22T00:00:00.000Z",
    },
    judgments: {
      route,
      context: {
        candidates: [
          {
            noteId: "note-1",
            include: { type: "noul", noul: 0.91 },
            relevance,
          },
        ],
        selectedNoteIds: ["note-1"],
      },
    },
    contextLimit: chatContextLimitSignal(1, 400),
    assistantMessage: {
      id: "assistant-1",
      threadId: "thread-1",
      role: "assistant",
      body: "소유권은 이쪽입니다 [1]",
      createdAt: "2026-09-22T00:00:01.000Z",
      sources: [{ noteId: "note-1", title: "소유권" }],
    },
    proposal: null,
    ...patch,
  };
}

describe("chat turn parser", () => {
  it("maps Kai sources to citation rows with relevance confidence", () => {
    const parsed = interpretTurnBody(200, turn());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.assistantMessage?.citations).toEqual([
      {
        index: 1,
        noteId: "note-1",
        title: "소유권",
        path: "notes/note-1",
        snippet: null,
        confidence: 0.7,
      },
    ]);
    expect(parsed.value.lowConfidence).toBe(false);
  });

  it("accepts citations[] when sources are absent", () => {
    const body = turn();
    const assistant = { ...(body.assistantMessage as object) } as Record<string, unknown>;
    delete assistant.sources;
    assistant.citations = [
      { noteId: "note-1", title: "소유권", snippet: "내 노트", path: "notes/note-1", score: 0.4 },
    ];
    const parsed = interpretTurnBody(200, { ...body, assistantMessage: assistant });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.assistantMessage?.citations[0]).toMatchObject({
      noteId: "note-1",
      snippet: "내 노트",
      confidence: 0.7,
    });
  });

  it("keeps an answer with an empty citation list", () => {
    const body = turn();
    const assistant = { ...(body.assistantMessage as object), sources: [] };
    const parsed = interpretTurnBody(200, { ...body, assistantMessage: assistant });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.assistantMessage?.citations).toEqual([]);
    expect(parsed.value.assistantMessage?.body).toContain("소유권");
  });

  it("keeps citation snippets when sources and citations are both present", () => {
    const body = turn();
    const assistant = {
      ...(body.assistantMessage as object),
      content: "소유권은 이쪽입니다 [1]",
      sources: [{ noteId: "note-1", title: "소유권" }],
      citations: [{ noteId: "note-1", title: "소유권", snippet: "내 노트" }],
      routing: { type: "choice", choice: "answer", confidence: 0.74, probabilities: { answer: 1 } },
    };
    const parsed = interpretTurnBody(200, { ...body, assistantMessage: assistant });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.assistantMessage?.citations[0]).toMatchObject({
      noteId: "note-1",
      snippet: "내 노트",
      confidence: 0.7,
    });
  });

  it("fails closed on judgment_failed, typesafe_misconfigured, 502, and 503", () => {
    expect(interpretTurnBody(502, { ok: false, code: "judgment_failed", answer: "키워드 결과" })).toEqual({
      ok: false,
      reason: "jev_error",
      contextLimit: null,
    });
    expect(interpretTurnBody(502, { ok: false, code: "jev_error" })).toMatchObject({ reason: "jev_error" });
    expect(interpretTurnBody(503, { ok: false, code: "typesafe_misconfigured" })).toMatchObject({
      reason: "key_missing",
    });
    expect(interpretTurnBody(503, { ok: false, code: "key_missing" })).toMatchObject({
      reason: "key_missing",
    });
    expect(interpretTurnBody(502, { ok: false, code: "codex_failed" })).toMatchObject({
      reason: "error",
    });
    expect(interpretTurnBody(502, null)).toMatchObject({ ok: false, reason: "jev_error" });
    expect(interpretTurnBody(503, null)).toMatchObject({ ok: false, reason: "key_missing" });
  });

  it("rejects a keyword fallback envelope without returning its answer", () => {
    const parsed = interpretTurnBody(200, { ...turn(), keywordFallback: true, fallback: "키워드" });
    expect(parsed).toMatchObject({ ok: false, reason: "jev_error" });
  });

  it("treats an over-cap success as context_limit and drops the assistant", () => {
    const parsed = interpretTurnBody(200, {
      ...turn(),
      contextLimit: chatContextLimitSignal(11, 100),
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.reason).toBe("context_limit");
    expect(parsed.contextLimit?.noteCount).toBe(11);
    expect(JSON.stringify(parsed)).not.toContain("소유권은 이쪽");
  });

  it("splits inline citation marks", () => {
    expect(splitCitationMarks("앞에서 [1] 그리고 [2]")).toEqual([
      { kind: "text", text: "앞에서 " },
      { kind: "cite", n: 1 },
      { kind: "text", text: " 그리고 " },
      { kind: "cite", n: 2 },
    ]);
  });
});
