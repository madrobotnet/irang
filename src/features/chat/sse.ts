import type { LocalizedText } from "@/lib/i18n/locale";
import type { ChatMessage, Citation } from "@/lib/types";

/** One dispatched server-sent event: `event:` name plus joined `data:` lines. */
export type SseFrame = { event: string; data: string };

/** Typed chat events from POST /api/chat/threads/:id/messages. */
export type ChatStreamEvent =
  | { type: "citations"; citations: Citation[] }
  | { type: "delta"; text: string }
  | { type: "done"; message: ChatMessage }
  | { type: "error"; code: string; message: string }
  /** A known event whose payload could not be parsed; the stream is no longer trustworthy. */
  | { type: "malformed"; event: string };

export type StreamOutcome =
  | { kind: "done"; message: ChatMessage }
  /** `message` is a server diagnostic and is never shown; `localized` is the user-facing text of an HTTP error body, when sent. */
  | { kind: "error"; code: string; message: string; localized?: LocalizedText }
  /** The body ended (or broke) before a `done` or `error` event: never a successful answer. */
  | { kind: "incomplete"; reason: "eof" | "malformed" | "network" }
  | { kind: "aborted" };

export type StreamHandlers = {
  onCitations?: (citations: Citation[]) => void;
  onDelta?: (text: string) => void;
};

/**
 * Incremental SSE frame parser (WHATWG EventSource line rules) that makes no
 * assumption about where network chunks split: mid-UTF-8 sequence, between
 * `\r` and `\n`, or mid-frame. Frames are dispatched only on their blank
 * line, so a truncated trailing frame is never delivered.
 */
export function createSseParser() {
  const decoder = new TextDecoder("utf-8");
  let text = "";
  let event = "";
  let data: string[] = [];

  const consumeLine = (line: string, out: SseFrame[]): void => {
    if (line === "") {
      if (data.length > 0) out.push({ event: event || "message", data: data.join("\n") });
      event = "";
      data = [];
      return;
    }
    if (line.startsWith(":")) return;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") event = value;
    else if (field === "data") data.push(value);
    // `id`, `retry` and unknown fields are ignored on purpose.
  };

  const drain = (flush: boolean): SseFrame[] => {
    const out: SseFrame[] = [];
    let start = 0;
    for (;;) {
      const cr = text.indexOf("\r", start);
      const lf = text.indexOf("\n", start);
      let end: number;
      let next: number;
      if (cr === -1 && lf === -1) break;
      if (cr !== -1 && (lf === -1 || cr < lf)) {
        // A trailing CR may be the first half of CRLF still in flight; wait unless flushing.
        if (cr === text.length - 1 && !flush) break;
        end = cr;
        next = text[cr + 1] === "\n" ? cr + 2 : cr + 1;
      } else {
        end = lf;
        next = lf + 1;
      }
      consumeLine(text.slice(start, end), out);
      start = next;
    }
    text = text.slice(start);
    return out;
  };

  return {
    /** Feed raw bytes; returns every frame completed by this chunk. */
    push(chunk: Uint8Array): SseFrame[] {
      text += decoder.decode(chunk, { stream: true });
      return drain(false);
    },
    /** Signal EOF; flushes decoder state and any final line, but never an unterminated frame. */
    end(): SseFrame[] {
      text += decoder.decode();
      return drain(true);
    },
  };
}

function isCitation(value: unknown): value is Citation {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.index === "number" && typeof row.noteId === "string"
    && typeof row.title === "string" && typeof row.excerpt === "string";
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" && (row.role === "user" || row.role === "assistant")
    && typeof row.content === "string" && Array.isArray(row.citations) && typeof row.createdAt === "string";
}

/** Map a raw frame to a chat event; unknown event names yield null (ignored). */
export function parseChatEvent(frame: SseFrame): ChatStreamEvent | null {
  if (!["citations", "delta", "done", "error"].includes(frame.event)) return null;
  let payload: unknown;
  try {
    payload = JSON.parse(frame.data);
  } catch {
    return { type: "malformed", event: frame.event };
  }
  switch (frame.event) {
    case "citations":
      if (!Array.isArray(payload)) return { type: "malformed", event: frame.event };
      return { type: "citations", citations: payload.filter(isCitation) };
    case "delta": {
      const text = (payload as { text?: unknown } | null)?.text;
      if (typeof text !== "string") return { type: "malformed", event: frame.event };
      return { type: "delta", text };
    }
    case "done": {
      const message = (payload as { message?: unknown } | null)?.message;
      if (!isChatMessage(message)) return { type: "malformed", event: frame.event };
      return { type: "done", message: { ...message, citations: message.citations.filter(isCitation) } };
    }
    default: {
      const row = (payload ?? {}) as { code?: unknown; message?: unknown };
      return {
        type: "error",
        code: typeof row.code === "string" ? row.code : "internal",
        message: typeof row.message === "string" ? row.message : "",
      };
    }
  }
}

/**
 * Consume a chat response body to a single outcome. Reading stops at the
 * first `done`/`error`/malformed event; `signal` cancels the underlying reader.
 */
export async function readChatStream(
  body: ReadableStream<Uint8Array>,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<StreamOutcome> {
  const reader = body.getReader();
  const parser = createSseParser();
  const onAbort = (): void => void reader.cancel().catch(() => undefined);
  if (signal?.aborted) {
    onAbort();
    reader.releaseLock();
    return { kind: "aborted" };
  }
  signal?.addEventListener("abort", onAbort, { once: true });

  const apply = (frames: SseFrame[]): StreamOutcome | null => {
    for (const frame of frames) {
      const event = parseChatEvent(frame);
      if (!event) continue;
      switch (event.type) {
        case "citations":
          handlers.onCitations?.(event.citations);
          break;
        case "delta":
          handlers.onDelta?.(event.text);
          break;
        case "done":
          return { kind: "done", message: event.message };
        case "error":
          return { kind: "error", code: event.code, message: event.message };
        case "malformed":
          return { kind: "incomplete", reason: "malformed" };
      }
    }
    return null;
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (signal?.aborted) return { kind: "aborted" };
      if (done) return apply(parser.end()) ?? { kind: "incomplete", reason: "eof" };
      const outcome = apply(parser.push(value));
      if (outcome) {
        await reader.cancel().catch(() => undefined);
        return outcome;
      }
    }
  } catch {
    return signal?.aborted ? { kind: "aborted" } : { kind: "incomplete", reason: "network" };
  } finally {
    signal?.removeEventListener("abort", onAbort);
    reader.releaseLock();
  }
}
