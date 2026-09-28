import { ChatProviderError } from "./provider";

type EventHandler = (event: unknown) => void;

/** Consume JSON SSE without assuming network chunks align to lines or events. */
export async function consumeJsonSse(
  body: ReadableStream<Uint8Array>,
  onEvent: EventHandler,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const consumeEvent = (block: string): void => {
    const data = block.split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data || data === "[DONE]") return;
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
      buffer += decoder.decode(value, { stream: !done });
      buffer = buffer.replaceAll("\r\n", "\n");
      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        consumeEvent(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf("\n\n");
      }
      if (done) break;
    }
    if (buffer.trim()) consumeEvent(buffer);
  } catch (error) {
    if (error instanceof ChatProviderError) throw error;
    throw new ChatProviderError();
  } finally {
    reader.releaseLock();
  }
}
