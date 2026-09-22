import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { chatContextLimitSignal } from "@/lib/chat/dto";
import {
  chatProposalDecisionPath,
  createChatThread,
  decideNoteEdit,
  listChatThreads,
  proposeNoteEdit,
  sendChatMessage,
} from "./client";

const source = readFileSync(fileURLToPath(new URL("./client.ts", import.meta.url)), "utf8");

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const turnBody = {
  ok: true,
  threadId: "thread-1",
  userMessage: {
    id: "user-1",
    threadId: "thread-1",
    role: "user",
    body: "질문",
    createdAt: "2026-09-22T00:00:00.000Z",
  },
  judgments: {
    route: {
      type: "choice",
      choice: "answer",
      confidence: 0.8,
      probabilities: { answer: 0.8, propose_edit: 0.1, none: 0.1 },
    },
    context: {
      candidates: [
        {
          noteId: "note-1",
          include: { type: "noul", noul: 0.9 },
          relevance: {
            type: "score",
            score: 2,
            legend: { "2": "관련" },
            probabilities: { "2": 1 },
            confidence: 0.66,
          },
        },
      ],
      selectedNoteIds: ["note-1"],
    },
  },
  contextLimit: chatContextLimitSignal(1, 200),
  assistantMessage: {
    id: "assistant-1",
    threadId: "thread-1",
    role: "assistant",
    body: "답 [1]",
    createdAt: "2026-09-22T00:00:01.000Z",
    sources: [{ noteId: "note-1", title: "소유권" }],
  },
  proposal: null,
};

describe("chat client", () => {
  it("does not call note write routes", () => {
    expect(source).not.toContain("/api/notes");
    expect(source).not.toContain("updateNote");
    expect(source).not.toContain("PATCH");
  });

  it("treats a missing thread collection as an empty list", async () => {
    const fetchImpl = vi.fn(async () => new Response("missing", { status: 404 }));
    const listed = await listChatThreads(fetchImpl);
    expect(listed).toEqual({ ok: true, value: { threads: [], nextCursor: null } });
    expect(fetchImpl).toHaveBeenCalledWith("/api/chat", expect.objectContaining({ credentials: "include" }));
  });

  it("posts a thread and a message on Kai paths", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "POST" && url === "/api/chat") {
        return jsonResponse({
          ok: true,
          thread: {
            id: "thread-1",
            title: "질문",
            createdAt: "2026-09-22T00:00:00.000Z",
            updatedAt: "2026-09-22T00:00:00.000Z",
          },
        });
      }
      return jsonResponse(turnBody);
    });
    const created = await createChatThread("질문", fetchImpl);
    expect(created.ok).toBe(true);
    const deltas: string[] = [];
    const sent = await sendChatMessage(
      "thread-1",
      { body: "질문", candidateNoteIds: ["note-1"] },
      (delta) => deltas.push(delta),
      fetchImpl,
    );
    expect(sent.ok).toBe(true);
    const messageCall = fetchImpl.mock.calls.find((call) => String(call[0]) === "/api/chat/thread-1/messages");
    expect(messageCall?.[1]?.method).toBe("POST");
    expect(JSON.parse(String(messageCall?.[1]?.body))).toEqual({
      body: "질문",
      candidateNoteIds: ["note-1"],
    });
    expect(deltas).toEqual([]);
  });

  it("reads SSE deltas and the final cited turn", async () => {
    const payload = `data: ${JSON.stringify({ delta: "답" })}\n\ndata: ${JSON.stringify(turnBody)}\n\n`;
    const fetchImpl = vi.fn(async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(payload));
          controller.close();
        },
      });
      return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
    });
    const deltas: string[] = [];
    const sent = await sendChatMessage("thread-1", { body: "질문" }, (delta) => deltas.push(delta), fetchImpl);
    expect(deltas).toEqual(["답"]);
    expect(sent.ok).toBe(true);
    if (!sent.ok) return;
    expect(sent.value.assistantMessage?.citations[0]?.noteId).toBe("note-1");
  });

  it("proposes an edit and approves only through the decision route", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/propose-edit")) {
        return jsonResponse({
          ok: true,
          proposal: {
            proposalId: "proposal-1",
            threadId: "thread-1",
            messageId: "assistant-1",
            noteId: "note-1",
            proposedTitle: "소유권",
            proposedBody: "고친 본문",
            status: "pending_approval",
          },
        });
      }
      return jsonResponse({ ok: true });
    });
    const proposed = await proposeNoteEdit(
      "thread-1",
      {
        noteId: "note-1",
        messageId: "assistant-1",
        proposedTitle: "소유권",
        proposedBody: "고친 본문",
      },
      fetchImpl,
    );
    expect(proposed.ok).toBe(true);
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe("/api/chat/thread-1/propose-edit");
    const decided = await decideNoteEdit("proposal-1", "approve", fetchImpl);
    expect(decided).toEqual({
      ok: true,
      value: { proposalId: "proposal-1", decision: "approve" },
    });
    expect(chatProposalDecisionPath("proposal-1", "approve")).toBe("/api/chat/proposals/proposal-1/approve");
    expect(String(fetchImpl.mock.calls[1]?.[0])).toBe("/api/chat/proposals/proposal-1/approve");
  });
});
