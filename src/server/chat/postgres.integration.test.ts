import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Questions, SystemOneResult } from "@typesafe-ai/sdk";
import { getPool, resetPoolForTests } from "@/server/db/postgres";
import { handleCreateNote, handleGetNote } from "@/server/notes/http";
import { PostgresNotesStore } from "@/server/notes/postgres-store";
import { ensureNotesSchema, resetNotesSchemaForTests } from "@/server/notes/schema";
import { resetNotesRuntimeForTests, setNotesStoreForTests } from "@/server/notes/runtime";
import type { SystemOneInvoker } from "@/server/typesafe/ports";
import { setSystemOneInvokerForTests } from "@/server/typesafe/runtime";
import { setCodexGeneratorForTests } from "./codex";
import { handleApproveProposal, handleCreateThread, handleListMessages, handlePostMessage } from "./http";
import { PostgresChatStore } from "./postgres-store";
import { resetChatRuntimeForTests, setChatStoreForTests } from "./runtime";
import { ensureChatSchema, resetChatSchemaForTests } from "./schema";

const databaseUrl = process.env.DATABASE_URL ?? "";
const runIntegration = process.env.RUN_PG_INTEGRATION === "1" && databaseUrl.length > 0;

const HIGH = {
  type: "score",
  score: 2.7,
  confidence: 0.8,
  legend: {
    "0": "Does not help answer or edit for the question.",
    "1": "Mentions the topic but is weak context.",
    "2": "Useful context for the question.",
    "3": "Directly answers the question or is the note to edit.",
  },
  probabilities: { "0": 0.02, "1": 0.08, "2": 0.2, "3": 0.7 },
};

function invoker(includedId: string): SystemOneInvoker {
  return {
    async systemOne<Q extends Questions>(request: { state: unknown; questions: Q }): Promise<SystemOneResult<Q>> {
      const questions = request.questions as Record<string, unknown>;
      const state = request.state as { notes?: { id: string }[] };
      const answers: Record<string, unknown> = {};
      if (questions.route) {
        answers.route = {
          type: "choice",
          choice: "propose_edit",
          confidence: 0.8,
          probabilities: { answer: 0.05, propose_edit: 0.9, none: 0.05 },
        };
      }
      for (let index = 0; index < (state.notes ?? []).length; index++) {
        const chosen = state.notes?.[index]?.id === includedId;
        answers[`include_${index}`] = { type: "noul", noul: chosen ? 0.9 : 0.1 };
        answers[`relevance_${index}`] = chosen
          ? HIGH
          : { ...HIGH, score: 0.1, probabilities: { "0": 0.9, "1": 0.1, "2": 0, "3": 0 } };
      }
      return { model: "jev-test", usage: { input_tokens: 1, output_tokens: 1 }, answers } as SystemOneResult<Q>;
    },
  };
}

describe.runIf(runIntegration)("Postgres chat schema", () => {
  beforeAll(async () => {
    resetPoolForTests();
    resetNotesSchemaForTests();
    resetChatSchemaForTests();
    await ensureNotesSchema(databaseUrl);
    await ensureChatSchema(databaseUrl);
    setNotesStoreForTests(new PostgresNotesStore(getPool(databaseUrl)));
    setChatStoreForTests(new PostgresChatStore(getPool(databaseUrl)));
    setCodexGeneratorForTests({
      async generate() {
        return { text: "Drafted from the note.", proposal: { title: "PG title", body: "PG body" } };
      },
    });
  });

  afterAll(() => {
    setSystemOneInvokerForTests(null);
    setCodexGeneratorForTests(null);
    resetNotesRuntimeForTests();
    resetChatRuntimeForTests();
    resetPoolForTests();
  });

  it("persists a cited assistant message and applies a proposal only on approve", async () => {
    const created = await handleCreateNote(
      new Request("http://localhost/api/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "PG old", body: "PG old body" }),
      }),
    );
    expect(created.status).toBe(201);
    const noteId = ((await created.json()) as { note: { id: string } }).note.id;
    setSystemOneInvokerForTests(invoker(noteId));

    const thread = await handleCreateThread(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "PG thread" }),
      }),
    );
    expect(thread.status).toBe(201);
    const threadId = ((await thread.json()) as { thread: { id: string } }).thread.id;

    const posted = await handlePostMessage(
      threadId,
      new Request(`http://localhost/api/chat/${threadId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: "Rewrite the note", candidateNoteIds: [noteId] }),
      }),
    );
    expect(posted.status).toBe(200);
    const turn = (await posted.json()) as {
      assistantMessage: { citations: { noteId: string }[] };
      proposal: { proposalId: string };
    };
    expect(turn.assistantMessage.citations.map((citation) => citation.noteId)).toEqual([noteId]);

    const before = await handleGetNote(noteId);
    expect(((await before.json()) as { note: { title: string } }).note.title).toBe("PG old");

    const approved = await handleApproveProposal(turn.proposal.proposalId);
    expect(approved.status).toBe(200);
    const after = await handleGetNote(noteId);
    expect(((await after.json()) as { note: { title: string; body: string } }).note).toMatchObject({
      title: "PG title",
      body: "PG body",
    });

    const messages = await handleListMessages(
      threadId,
      new Request(`http://localhost/api/chat/${threadId}/messages`),
    );
    const roles = ((await messages.json()) as { messages: { role: string; citations?: unknown[] }[] }).messages;
    expect(roles.map((message) => message.role)).toEqual(["user", "assistant"]);
    expect(roles[1]?.citations?.length).toBeGreaterThanOrEqual(1);

    const store = new PostgresChatStore(getPool(databaseUrl));
    await expect(
      store.createMessage({
        threadId,
        role: "assistant",
        content: "no sources",
        citations: [],
        routing: null,
      }),
    ).rejects.toThrow();
  });
});
