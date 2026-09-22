import { describe, expect, it } from "vitest";
import { chatContextLimitSignal } from "@/lib/chat/dto";
import { chatReducer, initialChatModel } from "./chat-state";
import type { ParsedTurn } from "./parse";
import { readChatQuery } from "./scope";

function model() {
  return initialChatModel(readChatQuery(new URLSearchParams("evidence=note-1")));
}

const turn: ParsedTurn = {
  threadId: "thread-1",
  userMessage: {
    id: "user-1",
    threadId: "thread-1",
    role: "user",
    body: "소유권은?",
    createdAt: "2026-09-22T00:00:00.000Z",
    citations: [],
  },
  assistantMessage: {
    id: "assistant-1",
    threadId: "thread-1",
    role: "assistant",
    body: "이쪽입니다 [1]",
    createdAt: "2026-09-22T00:00:01.000Z",
    citations: [
      {
        index: 1,
        noteId: "note-1",
        title: "소유권",
        path: "notes/note-1",
        snippet: "본문",
        confidence: 0.7,
      },
    ],
  },
  judgments: {
    route: {
      type: "choice",
      choice: "answer",
      confidence: 0.8,
      probabilities: { answer: 0.8, propose_edit: 0.1, none: 0.1 },
    },
    context: { candidates: [], selectedNoteIds: ["note-1"] },
  },
  contextLimit: chatContextLimitSignal(1, 400),
  proposal: null,
  lowConfidence: false,
};

describe("chat reducer", () => {
  it("starts on the evidence scope from the query", () => {
    expect(model().scope).toBe("evidence");
    expect(model().surface).toBe("idle");
  });

  it("streams deltas and then keeps the cited answer", () => {
    const streaming = chatReducer(chatReducer(model(), { type: "begin", question: "소유권은?" }), {
      type: "delta",
      delta: "이쪽",
    });
    expect(streaming.surface).toBe("streaming");
    expect(streaming.partial).toBe("이쪽");
    const done = chatReducer(streaming, { type: "turn", turn });
    expect(done.surface).toBe("done");
    expect(done.partial).toBe("");
    expect(done.messages.map((message) => message.id)).toEqual(["user-1", "assistant-1"]);
    expect(done.routeLabel).toBe("채팅");
  });

  it("drops a partial answer on jev_error", () => {
    const streaming = chatReducer(chatReducer(model(), { type: "begin", question: "소유권은?" }), {
      type: "delta",
      delta: "키워드로 추측",
    });
    const failed = chatReducer(streaming, { type: "fail", reason: "jev_error" });
    expect(failed.surface).toBe("jev_error");
    expect(failed.jev).toBe("jev_error");
    expect(failed.partial).toBe("");
    expect(failed.messages.some((message) => message.role === "assistant")).toBe(false);
    expect(failed.proposal).toBeNull();
  });

  it("opens the approve state only when a proposal exists", () => {
    const proposed = chatReducer(model(), {
      type: "turn",
      turn: {
        ...turn,
        proposal: {
          proposalId: "proposal-1",
          threadId: "thread-1",
          messageId: "assistant-1",
          noteId: "note-1",
          proposedTitle: "소유권",
          proposedBody: "고친 본문",
          tags: [{ tag: "법", probability: 0.8 }],
        },
        judgments: {
          ...turn.judgments,
          route: { ...turn.judgments.route, choice: "propose_edit" },
        },
      },
    });
    expect(proposed.surface).toBe("approving");
    expect(proposed.proposal?.proposedBody).toBe("고친 본문");
    const cancelled = chatReducer(proposed, { type: "cancel_approval" });
    expect(cancelled.surface).toBe("done");
    expect(cancelled.messages.some((message) => message.body === "고친 본문")).toBe(false);
  });

  it("records context_limit without an assistant message", () => {
    const limited = chatReducer(chatReducer(model(), { type: "begin", question: "많이" }), {
      type: "fail",
      reason: "context_limit",
      contextLimit: chatContextLimitSignal(11, 100),
    });
    expect(limited.surface).toBe("context_limit");
    expect(limited.contextLimit?.noteCount).toBe(11);
    expect(limited.messages.some((message) => message.role === "assistant")).toBe(false);
  });
});
