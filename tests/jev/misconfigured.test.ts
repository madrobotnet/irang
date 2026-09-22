import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import type { DuplicateJudgmentState } from "../../src/lib/jev/client";

const originalKey = process.env["TYPESAFE_API_KEY"];

const overlappingState: DuplicateJudgmentState = {
  incoming: {
    title: "weekly review",
    body: "ship the notes page",
    url: null,
  },
  candidates: [
    {
      id: "11111111-1111-1111-1111-111111111111",
      title: "weekly review",
      body: "ship the notes page",
    },
  ],
};

afterEach(() => {
  if (originalKey === undefined) delete process.env["TYPESAFE_API_KEY"];
  else process.env["TYPESAFE_API_KEY"] = originalKey;
});

function refuseNetwork(_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> {
  return Promise.reject(new Error("fetch must not run"));
}

async function withFetch<T>(fetchImpl: typeof globalThis.fetch, run: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    return await run();
  } finally {
    globalThis.fetch = original;
  }
}

describe("duplicate judgment configuration", () => {
  it("throws TypeSafeMisconfiguredError when TYPESAFE_API_KEY is missing", async () => {
    // Given: no API key, and a capture that keyword overlap could otherwise match
    delete process.env["TYPESAFE_API_KEY"];
    let fetched = false;
    const { judgeDuplicates, TypeSafeMisconfiguredError } = await import("../../src/lib/jev/client");

    // When
    const pending = withFetch((_input, _init) => {
      fetched = true;
      return refuseNetwork(_input, _init);
    }, () => judgeDuplicates(overlappingState));

    // Then
    await assert.rejects(pending, (error: unknown) => {
      if (!(error instanceof TypeSafeMisconfiguredError)) return false;
      assert.match(error.message, /typesafe_misconfigured/);
      return true;
    });
    assert.equal(fetched, false);
  });

  it("throws TypeSafeMisconfiguredError when the key is missing and nothing is comparable", async () => {
    // Given
    delete process.env["TYPESAFE_API_KEY"];
    let fetched = false;
    const { judgeDuplicates, TypeSafeMisconfiguredError } = await import("../../src/lib/jev/client");

    // When
    const pending = withFetch((_input, _init) => {
      fetched = true;
      return refuseNetwork(_input, _init);
    }, () => judgeDuplicates({ ...overlappingState, candidates: [] }));

    // Then
    await assert.rejects(pending, (error: unknown) => {
      if (!(error instanceof TypeSafeMisconfiguredError)) return false;
      assert.match(error.message, /typesafe_misconfigured/);
      return true;
    });
    assert.equal(fetched, false);
  });

  it("throws TypeSafeMisconfiguredError when TYPESAFE_API_KEY is blank", async () => {
    // Given
    process.env["TYPESAFE_API_KEY"] = "   ";
    let fetched = false;
    const { judgeDuplicates, TypeSafeMisconfiguredError } = await import("../../src/lib/jev/client");

    // When
    const pending = withFetch((_input, _init) => {
      fetched = true;
      return refuseNetwork(_input, _init);
    }, () => judgeDuplicates(overlappingState));

    // Then
    await assert.rejects(pending, (error: unknown) => {
      if (!(error instanceof TypeSafeMisconfiguredError)) return false;
      assert.match(error.message, /typesafe_misconfigured/);
      return true;
    });
    assert.equal(fetched, false);
  });
});
