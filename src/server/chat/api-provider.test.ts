import { describe, expect, test } from "bun:test";
import { createApiProvider, type ApiProviderInput } from "./api-provider";
import { TEST_INPUT } from "./api-provider-test-helpers";
import { ChatProviderError } from "./provider";

const PROVIDERS = [
  { provider: "openai", apiKey: "secret", model: "model" },
  { provider: "anthropic", apiKey: "secret", model: "model" },
  { provider: "google", apiKey: "secret", model: "model" },
  { provider: "github-copilot", apiKey: "secret", model: "model" },
  { provider: "openrouter", apiKey: "secret", model: "model" },
  { provider: "xai", apiKey: "secret", model: "model" },
  {
    provider: "openai-compatible",
    apiKey: "",
    model: "model",
    baseUrl: "http://compatible.test",
  },
  {
    provider: "anthropic-compatible",
    apiKey: "",
    model: "model",
    baseUrl: "http://compatible.test",
  },
] as const satisfies readonly ApiProviderInput[];

describe("API provider failures", () => {
  test("maps authentication and rate-limit responses to safe errors", async () => {
    for (const input of PROVIDERS) {
      for (const status of [401, 429]) {
        const fetchImpl: typeof fetch = Object.assign(
          async () => new Response("provider detail with secret", { status }),
          { preconnect: fetch.preconnect },
        );
        const provider = createApiProvider(input, { fetchImpl });

        const pending = provider.stream(TEST_INPUT, () => undefined, new AbortController().signal);
        await expect(pending).rejects.toBeInstanceOf(ChatProviderError);
        await expect(pending).rejects.toMatchObject({ message: expect.not.stringContaining("secret") });
      }
    }
  });

  test("maps network failures to safe errors", async () => {
    for (const input of PROVIDERS) {
      const fetchImpl: typeof fetch = Object.assign(
        async () => {
          throw new TypeError("network included secret");
        },
        { preconnect: fetch.preconnect },
      );
      const provider = createApiProvider(input, { fetchImpl });

      const pending = provider.stream(TEST_INPUT, () => undefined, new AbortController().signal);
      await expect(pending).rejects.toBeInstanceOf(ChatProviderError);
      await expect(pending).rejects.toMatchObject({ message: expect.not.stringContaining("secret") });
    }
  });

  test("forwards cancellation to every provider request", async () => {
    for (const input of PROVIDERS) {
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
      const provider = createApiProvider(input, { fetchImpl, timeoutMs: 10_000 });
      const abort = new AbortController();

      const pending = provider.stream(TEST_INPUT, () => undefined, abort.signal);
      abort.abort();

      await expect(pending).rejects.toMatchObject({ name: "ChatProviderError" });
      expect(observedAbort).toBe(true);
    }
  });
});
