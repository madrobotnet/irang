import { afterEach, describe, expect, test } from "bun:test";
import { EmbeddingUnavailable, learnedEmbeddings, SEMANTIC_DIMENSIONS } from "./learned";

const originalFetch = globalThis.fetch;
const originalUrl = process.env.EMBEDDING_BASE_URL;
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.EMBEDDING_BASE_URL;
  else process.env.EMBEDDING_BASE_URL = originalUrl;
});

function serve(data: unknown) {
  process.env.EMBEDDING_BASE_URL = "http://localhost:18431";
  globalThis.fetch = Object.assign(async () => Response.json(data), { preconnect: originalFetch.preconnect });
}

describe("learned embedding boundary", () => {
  test("requires configuration rather than generating fallback vectors", async () => {
    delete process.env.EMBEDDING_BASE_URL;
    await expect(learnedEmbeddings(["query"])).rejects.toBeInstanceOf(EmbeddingUnavailable);
  });
  test("orders and normalizes real-space vectors", async () => {
    const vector = Array.from({ length: SEMANTIC_DIMENSIONS }, (_, index) => index === 0 ? 1 : 0);
    serve({ data: [{ index: 1, embedding: vector }, { index: 0, embedding: vector }] });
    const result = await learnedEmbeddings(["a", "b"]);
    expect(result.length).toBe(2);
    expect(Math.hypot(...(result[0] ?? []))).toBe(1);
  });
  test("rejects input outside the proven resource envelope before calling the model", async () => {
    let calls = 0;
    process.env.EMBEDDING_BASE_URL = "http://localhost:18431";
    globalThis.fetch = Object.assign(async () => {
      calls++;
      return Response.json({ data: [] });
    }, { preconnect: originalFetch.preconnect });
    await expect(learnedEmbeddings(["x".repeat(1025)])).rejects.toBeInstanceOf(EmbeddingUnavailable);
    expect(calls).toBe(0);
  });
  test.each([
    { data: [{ index: 0, embedding: [1, 0] }] },
    { data: [{ index: 0, embedding: Array(SEMANTIC_DIMENSIONS).fill(0) }] },
    { data: [] },
    { data: [{ index: 1, embedding: Array(SEMANTIC_DIMENSIONS).fill(1) }] },
  ])("rejects malformed, zero and misindexed output", async (data) => {
    serve(data);
    await expect(learnedEmbeddings(["a"])).rejects.toBeInstanceOf(EmbeddingUnavailable);
  });
});
