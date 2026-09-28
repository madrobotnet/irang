import { describe, expect, test } from "bun:test";
import { consumeJsonSse } from "./api-provider-stream";
import { ChatProviderError } from "./provider";

const encoder = new TextEncoder();

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
