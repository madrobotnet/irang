import { ChatProviderError } from "./provider";

type EventHandler = (event: unknown) => void;
type DoneHandler = () => void;

const MAX_STREAM_BYTES = 4 * 1024 * 1024;
const MAX_EVENT_BYTES = 1024 * 1024;

/** Consume JSON SSE without assuming network chunks align to lines or events. */
export async function consumeJsonSse(
  body: ReadableStream<Uint8Array>,
  onEvent: EventHandler,
  onDone?: DoneHandler,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let streamBytes = 0;
  let didReceiveDone = false;
  let previousWasCr = false;

  const consumeEvent = (block: string): void => {
    if (Buffer.byteLength(block) > MAX_EVENT_BYTES) throw new ChatProviderError();
    const data = block.split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data) return;
    if (didReceiveDone) throw new ChatProviderError();
    if (data === "[DONE]") {
      didReceiveDone = true;
      onDone?.();
      return;
    }
    try {
      onEvent(JSON.parse(data));
    } catch (error) {
      if (error instanceof ChatProviderError) throw error;
      throw new ChatProviderError();
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      streamBytes += value?.byteLength ?? 0;
      if (streamBytes > MAX_STREAM_BYTES) throw new ChatProviderError();
      let text = decoder.decode(value, { stream: !done });
      if (text) {
        // A CR ends the line immediately; ignore its LF if it arrives later.
        if (previousWasCr && text.startsWith("\n")) text = text.slice(1);
        previousWasCr = text.endsWith("\r");
        buffer += text.replace(/\r\n?/g, "\n");
      }
      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        consumeEvent(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf("\n\n");
      }
      if (Buffer.byteLength(buffer) > MAX_EVENT_BYTES) throw new ChatProviderError();
      if (done) break;
    }
    if (buffer.trim()) consumeEvent(buffer);
  } catch (error) {
    try {
      await reader.cancel();
    } finally {
      if (error instanceof ChatProviderError) throw error;
      throw new ChatProviderError();
    }
  } finally {
    reader.releaseLock();
  }
}
