import { describe, expect, test } from "bun:test";
import type { ChatMessage, Citation } from "@/lib/types";
import { createSseParser, parseChatEvent, readChatStream, type SseFrame } from "./sse";

const encoder = new TextEncoder();

/** Exactly what src/server/chat/service.ts emits per event. */
function frame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** Split a UTF-8 byte string into chunks at arbitrary byte offsets (may cut multi-byte sequences). */
function bytesAt(text: string, cuts: number[]): Uint8Array[] {
  const bytes = encoder.encode(text);
  const chunks: Uint8Array[] = [];
  let start = 0;
  for (const cut of [...cuts, bytes.length]) {
    chunks.push(bytes.slice(start, cut));
    start = cut;
  }
  return chunks;
}

function stream(chunks: Uint8Array[], options: { failAfter?: boolean } = {}): ReadableStream<Uint8Array> {
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      const chunk = chunks[index++];
      if (chunk !== undefined) controller.enqueue(chunk);
      else if (options.failAfter) controller.error(new Error("socket reset"));
      else controller.close();
    },
  });
}

const citations: Citation[] = [
  { index: 1, noteId: "11111111-1111-4111-8111-111111111111", title: "주간 회고", excerpt: "이번 주 정리한 내용" },
  { index: 2, noteId: "22222222-2222-4222-8222-222222222222", title: "프로젝트 메모", excerpt: "다음 단계 계획" },
];

const doneMessage: ChatMessage = {
  id: "33333333-3333-4333-8333-333333333333",
  role: "assistant",
  content: "요약: 회고와 메모 두 노트를 근거로 정리했습니다. [1][2]",
  citations,
  createdAt: "2026-09-27T12:00:00.000Z",
};

describe("createSseParser", () => {
  test("dispatches frames only on their blank line and joins multi-line data", () => {
    const parser = createSseParser();
    const first = parser.push(encoder.encode("event: delta\ndata: {\"text\":\"a\"}\n"));
    expect(first).toEqual([]);
    const second = parser.push(encoder.encode("\n: keep-alive\n\ndata: x\ndata: y\n\n"));
    expect(second).toEqual([
      { event: "delta", data: "{\"text\":\"a\"}" },
      { event: "message", data: "x\ny" },
    ]);
  });

  test("reassembles a Hangul code point split across chunks", () => {
    const parser = createSseParser();
    const text = frame("delta", { text: "나뉜 응답" });
    const bytes = encoder.encode(text);
    // "나" starts right after `{"text":"`; cut inside its 3-byte sequence.
    const cut = encoder.encode("event: delta\ndata: {\"text\":\"").length + 1;
    const frames = [...parser.push(bytes.slice(0, cut)), ...parser.push(bytes.slice(cut)), ...parser.end()];
    expect(frames).toEqual([{ event: "delta", data: "{\"text\":\"나뉜 응답\"}" }]);
  });

  test("treats CRLF, CR and LF as line ends even when CR and LF arrive separately", () => {
    const parser = createSseParser();
    const frames: SseFrame[] = [];
    for (const chunk of ["event: delta\r", "\ndata: {\"text\":\"1\"}\r\n", "\r", "\nevent: delta\rdata: {\"text\":\"2\"}\r\r", "event: delta\ndata: 3\n\n"]) {
      frames.push(...parser.push(encoder.encode(chunk)));
    }
    frames.push(...parser.end());
    expect(frames).toEqual([
      { event: "delta", data: "{\"text\":\"1\"}" },
      { event: "delta", data: "{\"text\":\"2\"}" },
      { event: "delta", data: "3" },
    ]);
  });

  test("never emits an unterminated trailing frame at EOF", () => {
    const parser = createSseParser();
    expect(parser.push(encoder.encode("event: done\ndata: {\"message\":"))).toEqual([]);
    expect(parser.end()).toEqual([]);
  });
});

describe("parseChatEvent", () => {
  test("maps the four wire events and drops unknown names", () => {
    expect(parseChatEvent({ event: "citations", data: JSON.stringify(citations) })).toEqual({ type: "citations", citations });
    expect(parseChatEvent({ event: "delta", data: JSON.stringify({ text: "안" }) })).toEqual({ type: "delta", text: "안" });
    expect(parseChatEvent({ event: "done", data: JSON.stringify({ message: doneMessage }) })).toEqual({ type: "done", message: doneMessage });
    expect(parseChatEvent({ event: "error", data: JSON.stringify({ code: "upstream_failed", message: "실패" }) }))
      .toEqual({ type: "error", code: "upstream_failed", message: "실패" });
    expect(parseChatEvent({ event: "ping", data: "{}" })).toBeNull();
  });

  test("filters citations that lack the wire shape instead of inventing fields", () => {
    const parsed = parseChatEvent({
      event: "citations",
      data: JSON.stringify([citations[0], { noteId: "legacy", title: "old" }, "junk"]),
    });
    expect(parsed).toEqual({ type: "citations", citations: citations.slice(0, 1) });
  });

  test("flags bad JSON or a done without a message as malformed", () => {
    expect(parseChatEvent({ event: "delta", data: "{not json" })).toEqual({ type: "malformed", event: "delta" });
    expect(parseChatEvent({ event: "done", data: "{}" })).toEqual({ type: "malformed", event: "done" });
  });
});

describe("readChatStream", () => {
  test("delivers citations and deltas in order and resolves on done", async () => {
    const wire = frame("citations", citations) + frame("delta", { text: "요약: " }) + frame("delta", { text: "두 노트를 근거로" })
      + frame("done", { message: doneMessage });
    // Cut mid-"citations" JSON, mid-Hangul in the second delta, and inside the `\n\n` of done.
    const cuts = [40, wire.indexOf("근거") + 1, wire.length - 1];
    const seen: string[] = [];
    let sources: Citation[] = [];
    const outcome = await readChatStream(stream(bytesAt(wire, cuts)), {
      onCitations: (list) => {
        sources = list;
        seen.push("citations");
      },
      onDelta: (text) => seen.push(text),
    });
    expect(outcome).toEqual({ kind: "done", message: doneMessage });
    expect(sources).toEqual(citations);
    expect(seen).toEqual(["citations", "요약: ", "두 노트를 근거로"]);
  });

  test("an EOF without done is incomplete, keeping the partial text visible to the caller", async () => {
    const wire = frame("citations", citations) + frame("delta", { text: "부분 " }) + "event: done\ndata: {\"message\":{\"id\":";
    const deltas: string[] = [];
    const outcome = await readChatStream(stream(bytesAt(wire, [20, 70])), { onDelta: (t) => deltas.push(t) });
    expect(outcome).toEqual({ kind: "incomplete", reason: "eof" });
    expect(deltas).toEqual(["부분 "]);
  });

  test("a server error event ends the stream with its code and message", async () => {
    const wire = frame("citations", []) + frame("error", { code: "upstream_failed", message: "채팅 모델 응답을 받지 못했습니다." });
    const outcome = await readChatStream(stream(bytesAt(wire, [5, 33])), {});
    expect(outcome).toEqual({ kind: "error", code: "upstream_failed", message: "채팅 모델 응답을 받지 못했습니다." });
  });

  test("a transport failure mid-stream is incomplete, not done", async () => {
    const wire = frame("delta", { text: "절반" });
    const outcome = await readChatStream(stream(bytesAt(wire, [9]), { failAfter: true }), {});
    expect(outcome).toEqual({ kind: "incomplete", reason: "network" });
  });

  test("stops at the first malformed known event", async () => {
    const wire = frame("delta", { text: "ok" }) + "event: delta\ndata: {broken\n\n" + frame("done", { message: doneMessage });
    const deltas: string[] = [];
    const outcome = await readChatStream(stream([encoder.encode(wire)]), { onDelta: (t) => deltas.push(t) });
    expect(outcome).toEqual({ kind: "incomplete", reason: "malformed" });
    expect(deltas).toEqual(["ok"]);
  });

  test("aborting cancels the reader and reports aborted even if bytes are still queued", async () => {
    const controller = new AbortController();
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(ctrl) {
        pulls += 1;
        if (pulls === 1) {
          ctrl.enqueue(encoder.encode(frame("delta", { text: "첫 조각" })));
          return;
        }
        // Second read stays pending until the abort cancels the stream.
        controller.abort();
      },
    });
    const deltas: string[] = [];
    const outcome = await readChatStream(body, { onDelta: (t) => deltas.push(t) }, controller.signal);
    expect(outcome).toEqual({ kind: "aborted" });
    expect(deltas).toEqual(["첫 조각"]);
  });

  test("an already-aborted signal never reads the body", async () => {
    const controller = new AbortController();
    controller.abort();
    let pulled = false;
    const body = new ReadableStream<Uint8Array>({ pull: () => void (pulled = true) });
    expect(await readChatStream(body, {}, controller.signal)).toEqual({ kind: "aborted" });
    expect(pulled).toBe(false);
    expect(body.locked).toBe(false);
  });
});
