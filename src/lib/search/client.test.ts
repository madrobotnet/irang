import { afterEach, describe, expect, it } from "vitest";
import { judgeEvidence, searchNotes } from "./client";
import type { SearchResultsOk } from "./dto";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const ranked: SearchResultsOk = {
  ok: true,
  query: "소유",
  answersQuery: { type: "noul", noul: 0.8 },
  ranking: {
    type: "choice",
    choice: "note-1",
    probabilities: { "note-1": 0.8 },
    confidence: 0.7,
  },
  results: [{ noteId: "note-1", title: "소유권", snippet: "내 노트" }],
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("searchNotes", () => {
  it("calls GET /api/search and returns the envelope", async () => {
    const urls: string[] = [];
    globalThis.fetch = async (input) => {
      urls.push(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
      return jsonResponse(200, ranked);
    };
    await expect(searchNotes("소유")).resolves.toEqual({ ok: true, envelope: ranked });
    expect(urls).toEqual(["/api/search?query=%EC%86%8C%EC%9C%A0"]);
  });

  it("does not surface keyword rows when judgment fails", async () => {
    globalThis.fetch = async () =>
      jsonResponse(502, {
        ok: false,
        code: "judgment_failed",
        results: [{ noteId: "kw", title: "키워드만", snippet: "quiet" }],
      });
    await expect(searchNotes("소유")).resolves.toEqual({ ok: false, reason: "jev_error" });
  });

  it("maps a missing key without calling another search", async () => {
    const urls: string[] = [];
    globalThis.fetch = async (input) => {
      urls.push(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
      return jsonResponse(503, { ok: false, code: "typesafe_misconfigured" });
    };
    await expect(searchNotes("소유")).resolves.toEqual({ ok: false, reason: "key_missing" });
    expect(urls).toEqual(["/api/search?query=%EC%86%8C%EC%9C%A0"]);
  });

  it("maps a network failure to error", async () => {
    globalThis.fetch = async () => {
      throw new Error("offline");
    };
    await expect(searchNotes("소유")).resolves.toEqual({ ok: false, reason: "error" });
  });
});

describe("judgeEvidence", () => {
  it("posts candidate ids to the evidence seat", async () => {
    let url = "";
    let init: RequestInit | undefined;
    globalThis.fetch = async (input, options) => {
      url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      init = options;
      return jsonResponse(200, {
        ok: true,
        query: "소유",
        notes: [
          {
            noteId: "note-1",
            title: "소유권",
            answers: { type: "noul", noul: 0.88 },
            relevance: null,
            similarity: {
              type: "score",
              score: 2,
              legend: { "2": "비슷한 의미" },
              probabilities: { "2": 0.7 },
              confidence: 0.66,
            },
          },
        ],
      });
    };
    const result = await judgeEvidence({ query: "소유", candidateNoteIds: ["note-1"] });
    expect(result.ok).toBe(true);
    expect(url).toBe("/api/search/evidence");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ query: "소유", candidateNoteIds: ["note-1"] }));
  });

  it("drops evidence notes when judgment fails", async () => {
    globalThis.fetch = async () =>
      jsonResponse(502, {
        ok: false,
        code: "judgment_failed",
        notes: [{ noteId: "note-1", title: "소유권" }],
      });
    await expect(judgeEvidence({ query: "소유", candidateNoteIds: ["note-1"] })).resolves.toEqual({
      ok: false,
      reason: "jev_error",
    });
  });
});
