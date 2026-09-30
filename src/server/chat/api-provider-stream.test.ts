import { describe, expect, test } from "bun:test";
import { consumeJsonSse } from "./api-provider-stream";
import { ChatProviderError } from "./provider";

const encoder = new TextEncoder();

describe("consumeJsonSse line endings", () => {
  for (const [name, newline] of [["LF", "\n"], ["CRLF", "\r\n"], ["CR", "\r"]] as const) {
    for (const fragmented of [false, true]) {
      test(`parses ${name} events with ${fragmented ? "single-byte and empty" : "whole"} chunks`, async () => {
        const bytes = encoder.encode([
          ": heartbeat",
          "event: message",
          "data: {",
          'data: "value": "한글"',
          "data: }",
          "",
          'data: {"value":"second"}',
          "",
          "data: [DONE]",
          "",
          "",
        ].join(newline));
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            if (fragmented) {
              for (const byte of bytes) {
                controller.enqueue(Uint8Array.of(byte));
                controller.enqueue(new Uint8Array());
              }
            } else {
              controller.enqueue(bytes);
            }
            controller.close();
          },
        });
        const events: unknown[] = [];
        let done = 0;

        await consumeJsonSse(body, (event) => events.push(event), () => { done += 1; });

        expect(events).toEqual([{ value: "한글" }, { value: "second" }]);
        expect(done).toBe(1);
      });
    }
  }
});

async function expectCancellation(promise: Promise<void>): Promise<void> {
  const timeoutSignal = AbortSignal.timeout(1_000);
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutSignal.addEventListener("abort", () => {
      reject(new Error("stream cancellation was not observed"));
    }, { once: true });
  });
  await Promise.race([promise, timeout]);
}

describe("consumeJsonSse resource cleanup", () => {
  for (const fixture of [
    {
      name: "malformed JSON",
      chunk: "data: {\n\n",
      onEvent: () => undefined,
    },
    {
      name: "an oversized event",
      chunk: `data: ${"x".repeat(1024 * 1024)}\n\n`,
      onEvent: () => undefined,
    },
    {
      name: "an event handler failure",
      chunk: "data: {}\n\n",
      onEvent: () => {
        throw new ChatProviderError();
      },
    },
  ] as const) {
    test(`cancels the source after ${fixture.name}`, async () => {
      const cancelled = Promise.withResolvers<void>();
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(fixture.chunk));
        },
        cancel() {
          cancelled.resolve();
        },
      });

      const pending = consumeJsonSse(body, fixture.onEvent);

      await expect(pending).rejects.toBeInstanceOf(ChatProviderError);
      await expectCancellation(cancelled.promise);
    });
  }
});
