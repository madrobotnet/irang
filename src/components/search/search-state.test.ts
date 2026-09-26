import { describe, expect, it } from "vitest";
import type { SearchResultsOk } from "@/lib/search/dto";
import {
  evidenceChatReady,
  initialSearchModel,
  searchBadgeState,
  searchReducer,
  showsJevOn,
} from "./search-state";

const envelope: SearchResultsOk = {
  ok: true,
  indexStatus: "ready",
  query: "소유",
  answersQuery: { type: "noul", noul: 0.9 },
  ranking: {
    type: "choice",
    choice: "note-1",
    probabilities: { "note-1": 0.9 },
    confidence: 0.4,
  },
  results: [{ noteId: "note-1", title: "소유권", snippet: "본문" }],
};

describe("searchReducer", () => {
  it("starts idle and shows Jev ON", () => {
    expect(initialSearchModel.surface).toBe("idle");
    expect(showsJevOn("idle", "idle")).toBe(true);
    expect(searchBadgeState("idle", null, "idle")).toBe("jev_ready");
  });

  it("stores a judged envelope and clears it on TypeSafe failure", () => {
    const loaded = searchReducer(initialSearchModel, { type: "succeed", envelope });
    expect(loaded.surface).toBe("results");
    expect(loaded.envelope?.results[0]?.title).toBe("소유권");
    expect(searchBadgeState("results", 0.4, "idle")).toBe("jev_low_confidence");

    const failed = searchReducer(loaded, { type: "fail", reason: "jev_error" });
    expect(failed.surface).toBe("jev_error");
    expect(failed.envelope).toBeNull();
    expect(failed.selected).toEqual([]);
    expect(showsJevOn("jev_error", "idle")).toBe(false);
  });

  it("enables chat only after a check and a ready evidence envelope", () => {
    const loaded = searchReducer(initialSearchModel, { type: "succeed", envelope });
    expect(evidenceChatReady(loaded)).toBe(false);
    const picked = searchReducer(loaded, { type: "toggle_evidence", id: "note-1" });
    expect(evidenceChatReady(picked)).toBe(false);
    const ready = searchReducer(picked, {
      type: "evidence_ok",
      envelope: {
        ok: true,
        indexStatus: "ready",
        query: "소유",
        notes: [
          {
            noteId: "note-1",
            title: "소유권",
            answers: { type: "noul", noul: 0.8 },
            relevance: null,
            similarity: {
              type: "score",
              score: 1,
              legend: { "1": "같은 주제" },
              probabilities: { "1": 0.8 },
              confidence: 0.7,
            },
          },
        ],
      },
    });
    expect(evidenceChatReady(ready)).toBe(true);
    const blocked = searchReducer(picked, { type: "evidence_fail", reason: "jev_error" });
    expect(evidenceChatReady(blocked)).toBe(false);
    expect(blocked.envelope?.results).toHaveLength(1);
  });

  it("does not keep a route judgment the envelope did not send", () => {
    const loaded = searchReducer(
      { ...initialSearchModel, route: "chat" },
      { type: "succeed", envelope },
    );
    expect(loaded.route).toBeNull();
  });

  it("keeps hits on succeed when the corpus is still indexing", () => {
    const loaded = searchReducer(initialSearchModel, {
      type: "succeed",
      envelope: { ...envelope, indexStatus: "indexing" },
    });
    expect(loaded.surface).toBe("results");
    expect(loaded.envelope?.indexStatus).toBe("indexing");
    expect(loaded.envelope?.results).toHaveLength(1);
    expect(showsJevOn(loaded.surface, loaded.evidence.status)).toBe(true);
  });
});
