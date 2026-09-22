import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Questions, SystemOneResult } from "@typesafe-ai/sdk";
import { MemoryNotesStore } from "@/server/notes/memory-store";
import { resetNotesRuntimeForTests, setNotesStoreForTests } from "@/server/notes/runtime";
import { setSystemOneInvokerForTests } from "@/server/typesafe/runtime";
import type { SystemOneInvoker } from "@/server/typesafe/ports";
import { handleCreateNote } from "@/server/notes/http";
import { runOvernightIndexBatch } from "./batch";
import { handleEvidence, handleSearch } from "./http";
import { MemorySearchIndex } from "./memory-index";
import { resetSearchRuntimeForTests, setSearchIndexForTests } from "./runtime";

const RELEVANCE = {
  type: "score",
  score: 2.4,
  confidence: 0.74,
  legend: {
    "0": "Unrelated to the question.",
    "1": "Mentions the topic but does not answer it.",
    "2": "Partial evidence for the question.",
    "3": "Direct evidence that answers the question.",
  },
  probabilities: { "0": 0.05, "1": 0.1, "2": 0.25, "3": 0.6 },
};

const SIMILARITY = {
  type: "score",
  score: 2.1,
  confidence: 0.66,
  legend: {
    "0": "Unrelated meaning.",
    "1": "Same broad topic, different meaning.",
    "2": "Closely related meaning.",
    "3": "The same meaning as the query.",
  },
  probabilities: { "0": 0.05, "1": 0.15, "2": 0.45, "3": 0.35 },
};

function searchInvoker(preferredId: string | null): SystemOneInvoker {
  return {
    async systemOne<Q extends Questions>(request: { state: unknown; questions: Q }): Promise<SystemOneResult<Q>> {
      const questions = request.questions as Record<string, { type?: string }>;
      const state = request.state as { candidates?: { id: string }[] };
      const answers: Record<string, unknown> = {};
      if (questions.ranking) {
        const ids = ["none", ...(state.candidates ?? []).map((candidate) => candidate.id)];
        const probabilities: Record<string, number> = {};
        const rest = ids.length > 1 ? 0.2 / (ids.length - 1) : 0;
        for (const id of ids) {
          probabilities[id] = id === (preferredId ?? "none") ? 0.8 : rest;
        }
        if (!preferredId) {
          probabilities.none = 1;
          for (const id of ids) {
            if (id !== "none") {
              probabilities[id] = 0;
            }
          }
        }
        answers.ranking = {
          type: "choice",
          choice: preferredId ?? "none",
          confidence: 0.8,
          probabilities,
        };
      }
      if (questions.answersQuery) {
        answers.answersQuery = { type: "noul", noul: 0.77 };
      }
      if (questions.any_evidence) {
        answers.any_evidence = { type: "noul", noul: 0.04 };
      }
      const candidates = state.candidates ?? [];
      for (let index = 0; index < candidates.length; index++) {
        if (questions[`answers_${index}`]) {
          answers[`answers_${index}`] = {
            type: "noul",
            noul: candidates[index]?.id === preferredId ? 0.91 : 0.12,
          };
        }
        const preferred = candidates[index]?.id === preferredId;
        if (questions[`relevance_${index}`]) {
          answers[`relevance_${index}`] = preferred
            ? RELEVANCE
            : {
                ...RELEVANCE,
                score: 0.15,
                probabilities: { "0": 0.85, "1": 0.15, "2": 0, "3": 0 },
              };
        }
        if (questions[`similarity_${index}`]) {
          answers[`similarity_${index}`] = preferred
            ? SIMILARITY
            : {
                ...SIMILARITY,
                score: 0.1,
                probabilities: { "0": 0.9, "1": 0.1, "2": 0, "3": 0 },
              };
        }
      }
      return {
        model: "jev-latest",
        usage: { input_tokens: 1, output_tokens: 1 },
        answers,
      } as SystemOneResult<Q>;
    },
  };
}

async function createNote(title: string, body: string): Promise<string> {
  const response = await handleCreateNote(
    new Request("http://localhost/api/notes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, body }),
    }),
  );
  expect(response.status).toBe(201);
  const json = (await response.json()) as { note: { id: string } };
  return json.note.id;
}

beforeEach(() => {
  process.env.TYPESAFE_API_KEY = "test-key-not-used-with-mock";
  setNotesStoreForTests(new MemoryNotesStore());
  setSearchIndexForTests(new MemorySearchIndex());
  setSystemOneInvokerForTests(searchInvoker(null));
});

afterEach(() => {
  setSystemOneInvokerForTests(null);
  delete process.env.TYPESAFE_API_KEY;
  resetNotesRuntimeForTests();
  resetSearchRuntimeForTests();
});

describe("search API", () => {
  it("returns the Kai envelope ordered by the ranking Choice, not keyword order", async () => {
    const alpha = await createNote("alpha zebra", "alpha lives in the zebra note");
    const yacht = await createNote("alpha yacht", "alpha lives in the yacht note");
    setSystemOneInvokerForTests(searchInvoker(yacht));
    const response = await handleSearch(
      new Request("http://localhost/api/search?query=alpha"),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      ok: true;
      query: string;
      answersQuery: { type: string; noul: number; confidence?: number };
      ranking: { type: string; choice: string; confidence: number; probabilities: Record<string, number> };
      results: { noteId: string; title: string; snippet: string | null }[];
      fallback?: unknown;
      keywordScore?: unknown;
    };
    expect(body.ok).toBe(true);
    expect(body.query).toBe("alpha");
    expect(body.answersQuery).toEqual({ type: "noul", noul: 0.77 });
    expect(body.answersQuery).not.toHaveProperty("confidence");
    expect(body.ranking.type).toBe("choice");
    expect(body.ranking.choice).toBe(yacht);
    expect(body.ranking.confidence).toBe(0.8);
    expect(body.ranking.probabilities[yacht]).toBe(0.8);
    expect(body.results[0]?.noteId).toBe(yacht);
    expect(body.results.map((hit) => hit.noteId).sort()).toEqual([alpha, yacht].sort());
    expect(body.results[0]?.snippet).toContain("alpha");
    expect(body).not.toHaveProperty("fallback");
    expect(body).not.toHaveProperty("keywordScore");
    expect(body).not.toHaveProperty("mode");
  });

  it("accepts POST /api/search with the same envelope", async () => {
    const id = await createNote("postgres tsvector", "keyword index for notes");
    setSystemOneInvokerForTests(searchInvoker(id));
    const response = await handleSearch(
      new Request("http://localhost/api/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: "tsvector" }),
      }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { results: { noteId: string }[] };
    expect(body.results[0]?.noteId).toBe(id);
  });

  it("returns typesafe_misconfigured and no hits when the key is missing", async () => {
    await createNote("alpha", "alpha secret note");
    setSystemOneInvokerForTests(null);
    delete process.env.TYPESAFE_API_KEY;
    const response = await handleSearch(new Request("http://localhost/api/search?query=alpha"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, code: "typesafe_misconfigured" });
  });

  it("returns judgment_failed and does not fall back to keyword hits", async () => {
    await createNote("alpha", "alpha should not leak");
    setSystemOneInvokerForTests({
      async systemOne() {
        throw new Error("typesafe down");
      },
    });
    const response = await handleSearch(new Request("http://localhost/api/search?query=alpha"));
    expect(response.status).toBe(502);
    const body = (await response.json()) as { ok: false; code: string; results?: unknown };
    expect(body).toEqual({ ok: false, code: "judgment_failed" });
    expect(body).not.toHaveProperty("results");
  });

  it("applies a note status filter before Jev ranks", async () => {
    await createNote("alpha draft", "alpha stays a draft");
    setSystemOneInvokerForTests(searchInvoker(null));
    const response = await handleSearch(
      new Request("http://localhost/api/search?query=alpha&status=archived"),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      ranking: { choice: string };
      results: unknown[];
    };
    expect(body.ranking.choice).toBe("none");
    expect(body.results).toEqual([]);
  });

  it("rejects an empty query", async () => {
    const response = await handleSearch(new Request("http://localhost/api/search?query=%20"));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, code: "validation" });
  });

  it("embeds pending notes on search and can rank a note before that batch via keyword", async () => {
    const id = await createNote("vector clock", "distributed systems vector clock");
    const index = new MemorySearchIndex();
    setSearchIndexForTests(index);
    const { loadActiveNotes } = await import("./corpus");
    const { getNotesStore } = await import("@/server/notes/runtime");
    await index.sync(await loadActiveNotes(await getNotesStore()));
    const before = await index.keyword("vector", { from: null, to: null, status: null }, 10);
    expect(before.map((doc) => doc.id)).toEqual([id]);
    expect((await index.counts()).pending).toBe(1);
    const batch = await runOvernightIndexBatch(10);
    expect(batch.embedded).toBe(1);
    expect(batch.indexed).toBe(1);
    expect(batch.pending).toBe(0);
    const semantic = await index.semantic(
      (await import("@/domain/search/embed")).embedText("vector clock"),
      { from: null, to: null, status: null },
      5,
    );
    expect(semantic[0]?.id).toBe(id);
  });
});

describe("evidence API", () => {
  it("selects notes with judgment probability and score confidence", async () => {
    const keep = await createNote("ownership", "you own the uploaded notes");
    const drop = await createNote("license", "a license was never discussed");
    setSystemOneInvokerForTests(searchInvoker(keep));
    const response = await handleEvidence(
      new Request("http://localhost/api/search/evidence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query: "who owns uploaded notes?",
          candidateNoteIds: [drop, keep],
        }),
      }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      ok: true;
      query: string;
      notes: {
        noteId: string;
        answers: { type: string; noul: number; confidence?: number };
        relevance: { type: string; confidence: number; score: number } | null;
        similarity: { type: string; confidence: number };
      }[];
      keywordFallback?: unknown;
    };
    expect(body.query).toBe("who owns uploaded notes?");
    expect(body.notes.map((note) => note.noteId)).toEqual([keep]);
    expect(body.notes[0]?.answers).toEqual({ type: "noul", noul: 0.91 });
    expect(body.notes[0]?.answers).not.toHaveProperty("confidence");
    expect(body.notes[0]?.relevance?.type).toBe("score");
    expect(body.notes[0]?.relevance?.confidence).toBe(0.74);
    expect(body.notes[0]?.similarity.type).toBe("score");
    expect(body.notes[0]?.similarity.confidence).toBe(0.66);
    expect(body).not.toHaveProperty("keywordFallback");
  });

  it("preserves provided id order among the notes that pass", async () => {
    const first = await createNote("one", "evidence one");
    const second = await createNote("two", "evidence two");
    setSystemOneInvokerForTests(searchInvoker(first));
    const bothPass: SystemOneInvoker = {
      async systemOne(request) {
        const base = await searchInvoker(first).systemOne(request);
        const answers = { ...(base.answers as Record<string, unknown>) };
        const state = request.state as { candidates?: unknown[] };
        for (let index = 0; index < (state.candidates?.length ?? 0); index++) {
          answers[`answers_${index}`] = { type: "noul", noul: 0.8 };
        }
        return { ...base, answers } as typeof base;
      },
    };
    setSystemOneInvokerForTests(bothPass);
    const response = await handleEvidence(
      new Request("http://localhost/api/search/evidence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query: "evidence",
          candidateNoteIds: [second, first],
        }),
      }),
    );
    const body = (await response.json()) as { notes: { noteId: string }[] };
    expect(body.notes.map((note) => note.noteId)).toEqual([second, first]);
  });

  it("returns judgment_failed instead of the candidate list when TypeSafe fails", async () => {
    const id = await createNote("alpha", "alpha evidence");
    setSystemOneInvokerForTests({
      async systemOne() {
        throw new Error("down");
      },
    });
    const response = await handleEvidence(
      new Request("http://localhost/api/search/evidence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: "alpha", candidateNoteIds: [id] }),
      }),
    );
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ ok: false, code: "judgment_failed" });
  });

  it("rejects unknown candidate ids", async () => {
    const response = await handleEvidence(
      new Request("http://localhost/api/search/evidence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query: "missing",
          candidateNoteIds: ["00000000-0000-4000-8000-000000000000"],
        }),
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, code: "validation" });
  });
});

describe("search route modules", () => {
  it("mounts GET and POST on the Kai paths", async () => {
    const searchRoute = await import("@/app/api/search/route");
    const evidenceRoute = await import("@/app/api/search/evidence/route");
    expect(typeof searchRoute.GET).toBe("function");
    expect(typeof searchRoute.POST).toBe("function");
    expect(typeof evidenceRoute.GET).toBe("function");
    expect(typeof evidenceRoute.POST).toBe("function");
  });
});
