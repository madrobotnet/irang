import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CAPTURE_FETCH_TIMEOUT_MS,
  CAPTURE_PAGE_BYTE_LIMIT,
  summarizeUrl,
} from "./url-summary";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.URL_SUMMARY_FORCE_FAIL;
});

describe("summarizeUrl bounds", () => {
  it("uses a 10s timeout and a 256KB cap", () => {
    expect(CAPTURE_FETCH_TIMEOUT_MS).toBe(10_000);
    expect(CAPTURE_PAGE_BYTE_LIMIT).toBe(262_144);
  });

  it("rejects non-http(s) URLs before fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(summarizeUrl("file:///tmp/note.txt")).resolves.toEqual({
      ok: false,
      error: "unsupported_protocol",
    });
    await expect(summarizeUrl("ftp://example.com/file")).resolves.toEqual({
      ok: false,
      error: "unsupported_protocol",
    });
    await expect(summarizeUrl("not a url")).resolves.toEqual({
      ok: false,
      error: "invalid_url",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches http(s) with a 10s abort signal", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(new AbortController().signal);
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response("<p>Hello page</p>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
    );

    await expect(summarizeUrl("https://example.com/article")).resolves.toEqual({
      ok: true,
      summary: "Hello page",
    });
    await expect(summarizeUrl("http://example.com/plain")).resolves.toEqual({
      ok: true,
      summary: "Hello page",
    });
    expect(timeout).toHaveBeenCalledWith(10_000);
  });

  it("returns timeout, http status, and fetch failures without swallowing unexpected errors", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new DOMException("timed out", "TimeoutError");
    });
    await expect(summarizeUrl("https://example.com/slow")).resolves.toEqual({
      ok: false,
      error: "timeout",
    });

    vi.stubGlobal("fetch", async () => new Response("missing", { status: 404 }));
    await expect(summarizeUrl("https://example.com/missing")).resolves.toEqual({
      ok: false,
      error: "http_404",
    });

    vi.stubGlobal("fetch", async () => {
      throw new TypeError("network down");
    });
    await expect(summarizeUrl("https://example.com/down")).resolves.toEqual({
      ok: false,
      error: "fetch_failed",
    });

    vi.stubGlobal("fetch", async () => {
      throw new Error("boom");
    });
    await expect(summarizeUrl("https://example.com/boom")).rejects.toThrow("boom");
  });

  it("rejects a redirect whose final URL is not http(s)", async () => {
    const response = new Response("secret", {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
    Object.defineProperty(response, "url", { value: "file:///etc/passwd" });
    vi.stubGlobal("fetch", async () => response);

    await expect(summarizeUrl("https://example.com/start")).resolves.toEqual({
      ok: false,
      error: "unsupported_protocol",
    });
  });

  it("stops reading a page at 262144 bytes", async () => {
    let pulls = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        if (pulls > 4) {
          controller.error(new Error("read past cap"));
          return;
        }
        controller.enqueue(new Uint8Array(100_000).fill(97));
      },
    });
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(stream, {
          status: 200,
          headers: { "content-type": "text/plain" },
        }),
    );

    const result = await summarizeUrl("https://example.com/big");

    expect(result).toEqual({ ok: true, summary: "a".repeat(2000) });
    expect(pulls).toBeLessThanOrEqual(4);
    expect(pulls).toBeGreaterThan(0);
  });
});
