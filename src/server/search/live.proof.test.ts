import { afterAll, describe, expect, it } from "vitest";
import { handleCreateNote } from "@/server/notes/http";
import { MemoryNotesStore } from "@/server/notes/memory-store";
import { resetNotesRuntimeForTests, setNotesStoreForTests } from "@/server/notes/runtime";
import { setSystemOneInvokerForTests } from "@/server/typesafe/runtime";
import { handleEvidence, handleSearch } from "./http";
import { MemorySearchIndex } from "./memory-index";
import { resetSearchRuntimeForTests, setSearchIndexForTests } from "./runtime";

const runLive = process.env.RUN_TYPESAFE_PROOF === "1" && Boolean(process.env.TYPESAFE_API_KEY);

describe.runIf(runLive)("live TypeSafe search judgments", () => {
  afterAll(() => {
    setSystemOneInvokerForTests(null);
    resetNotesRuntimeForTests();
    resetSearchRuntimeForTests();
  });

  it("ranks notes and selects evidence without a keyword-only body", async () => {
    setSystemOneInvokerForTests(null);
    setNotesStoreForTests(new MemoryNotesStore());
    setSearchIndexForTests(new MemorySearchIndex());
    const ownership = await handleCreateNote(
      new Request("http://localhost/api/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Note ownership",
          body: "Uploaded notes in this vault belong to the single operator who captured them.",
        }),
      }),
    );
    const recipe = await handleCreateNote(
      new Request("http://localhost/api/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Kimchi stew",
          body: "Simmer kimchi with tofu and pork for a weeknight stew.",
        }),
      }),
    );
    expect(ownership.status).toBe(201);
    expect(recipe.status).toBe(201);
    const owned = ((await ownership.json()) as { note: { id: string } }).note.id;
    const cooked = ((await recipe.json()) as { note: { id: string } }).note.id;

    const search = await handleSearch(
      new Request("http://localhost/api/search?query=who%20owns%20uploaded%20notes"),
    );
    expect(search.status).toBe(200);
    const searchBody = (await search.json()) as {
      answersQuery: { type: string; noul: number };
      ranking: { type: string; choice: string; confidence: number; probabilities: Record<string, number> };
      results: { noteId: string }[];
    };
    expect(searchBody.answersQuery.type).toBe("noul");
    expect(searchBody.answersQuery.noul).toBeGreaterThanOrEqual(0);
    expect(searchBody.answersQuery.noul).toBeLessThanOrEqual(1);
    expect(searchBody.answersQuery).not.toHaveProperty("confidence");
    expect(searchBody.ranking.type).toBe("choice");
    expect(searchBody.ranking.confidence).toBeGreaterThanOrEqual(0);
    expect(searchBody.ranking.confidence).toBeLessThanOrEqual(1);
    expect(["none", owned, cooked]).toContain(searchBody.ranking.choice);
    expect(Object.keys(searchBody.ranking.probabilities).sort()).toEqual([cooked, "none", owned].sort());
    expect(searchBody.results.map((hit) => hit.noteId).sort()).toEqual([cooked, owned].sort());

    const evidence = await handleEvidence(
      new Request("http://localhost/api/search/evidence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query: "who owns uploaded notes?",
          candidateNoteIds: [owned, cooked],
        }),
      }),
    );
    expect(evidence.status).toBe(200);
    const evidenceBody = (await evidence.json()) as {
      notes: {
        noteId: string;
        answers: { type: string; noul: number };
        relevance: { type: string; confidence: number; probabilities: Record<string, number> } | null;
        similarity: { type: string; confidence: number };
      }[];
    };
    expect(evidenceBody.notes.length).toBeGreaterThan(0);
    expect(evidenceBody.notes.some((note) => note.noteId === owned)).toBe(true);
    for (const note of evidenceBody.notes) {
      expect(note.answers.type).toBe("noul");
      expect(note.answers).not.toHaveProperty("confidence");
      expect(note.relevance?.type).toBe("score");
      expect(note.relevance?.confidence).toBeGreaterThanOrEqual(0);
      expect(note.similarity.type).toBe("score");
      expect(note.similarity.confidence).toBeGreaterThanOrEqual(0);
    }
  }, 45000);
});
