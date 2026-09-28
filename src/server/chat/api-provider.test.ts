import { describe, expect, test } from "bun:test";
import { createApiProvider } from "./api-provider";
import { TEST_INPUT } from "./api-provider-test-helpers";
import { ChatProviderError } from "./provider";

const PROVIDERS = ["openai", "anthropic", "google"] as const;

describe("API provider failures", () => {
  test("maps authentication and rate-limit responses to safe errors", async () => {
    for (const providerName of PROVIDERS) {
      for (const status of [401, 429]) {
        const fetchImpl: typeof fetch = Object.assign(
          async () => new Response("provider detail with secret", { status }),
          { preconnect: fetch.preconnect },
        );
        const provider = createApiProvider(
          { provider: providerName, apiKey: "secret", model: "model" },
          { fetchImpl },
        );

        const pending = provider.stream(TEST_INPUT, () => undefined, new AbortController().signal);
        await expect(pending).rejects.toBeInstanceOf(ChatProviderError);
        await expect(pending).rejects.toMatchObject({ message: expect.not.stringContaining("secret") });
      }
    }
  });

  test("maps network failures to safe errors", async () => {
    for (const providerName of PROVIDERS) {
      const fetchImpl: typeof fetch = Object.assign(
        async () => {
          throw new TypeError("network included secret");
        },
        { preconnect: fetch.preconnect },
      );
      const provider = createApiProvider(
        { provider: providerName, apiKey: "secret", model: "model" },
        { fetchImpl },
      );

      const pending = provider.stream(TEST_INPUT, () => undefined, new AbortController().signal);
      await expect(pending).rejects.toBeInstanceOf(ChatProviderError);
      await expect(pending).rejects.toMatchObject({ message: expect.not.stringContaining("secret") });
    }
  });

  test("forwards cancellation to every provider request", async () => {
    for (const providerName of PROVIDERS) {
      let observedAbort = false;
      const fetchImpl: typeof fetch = Object.assign(
        async (_url: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            const signal = init?.signal;
            if (!signal) {
              reject(new TypeError("missing abort signal"));
              return;
            }
            const onAbort = (): void => {
              observedAbort = true;
              reject(new DOMException("Aborted", "AbortError"));
            };
            if (signal.aborted) onAbort();
            else signal.addEventListener("abort", onAbort, { once: true });
          }),
        { preconnect: fetch.preconnect },
      );
      const provider = createApiProvider(
        { provider: providerName, apiKey: "secret", model: "model" },
        { fetchImpl, timeoutMs: 10_000 },
      );
      const abort = new AbortController();

      const pending = provider.stream(TEST_INPUT, () => undefined, abort.signal);
      abort.abort();

      await expect(pending).rejects.toMatchObject({ name: "ChatProviderError" });
      expect(observedAbort).toBe(true);
    }
  });
});
