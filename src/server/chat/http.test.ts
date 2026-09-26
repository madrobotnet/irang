import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Questions, SystemOneResult } from "@typesafe-ai/sdk";
import { INBOX_CLASS_VOCABULARY } from "@/domain/inbox/classification";
import { CAPTURE_TAG_VOCABULARY } from "@/domain/judgments/tag-vocabulary";
import { CitationsRequiredError } from "@/domain/chat/errors";
import { handleCreateNote, handleGetNote } from "@/server/notes/http";
import { MemoryNotesStore } from "@/server/notes/memory-store";
import { resetNotesRuntimeForTests, setNotesStoreForTests } from "@/server/notes/runtime";
import type { SystemOneInvoker } from "@/server/typesafe/ports";
import { setSystemOneInvokerForTests } from "@/server/typesafe/runtime";
import { MemorySearchIndex } from "@/server/search/memory-index";
import { resetSearchRuntimeForTests, setSearchIndexForTests } from "@/server/search/runtime";
import { setCodexGeneratorForTests, type CodexTurnRequest } from "./codex";
import {
  handleApproveProposal,
  handleArchiveThread,
  handleCreateThread,
  handleGetThread,
  handleListMessages,
  handleListProposals,
  handleListThreads,
  handleManageSuggest,
  handlePostMessage,
  handleProposeEdit,
  handleRejectProposal,
} from "./http";
import { MemoryChatStore } from "./memory-store";
import { resetChatRuntimeForTests, setChatStoreForTests } from "./runtime";

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

const LOW = {
  ...HIGH,
  score: 0.15,
  probabilities: { "0": 0.9, "1": 0.1, "2": 0, "3": 0 },
};

type InvokerOptions = {
  route?: "answer" | "propose_edit" | "none";
  includedId?: string | null;
  fail?: boolean;
};

function chatInvoker(options: InvokerOptions = {}): SystemOneInvoker {
  const route = options.route ?? "answer";
  const includedId = options.includedId === undefined ? null : options.includedId;
  return {
    async systemOne<Q extends Questions>(request: {
      state: unknown;
      questions: Q;
    }): Promise<SystemOneResult<Q>> {
      if (options.fail) {
        throw new Error("system one down");
      }
      const questions = request.questions as Record<string, { type?: string }>;
      const state = request.state as { notes?: { id: string }[] };
      const answers: Record<string, unknown> = {};
      if (questions.route) {
        const probabilities = { answer: 0.05, propose_edit: 0.05, none: 0.05, [route]: 0.9 };
        answers.route = { type: "choice", choice: route, confidence: 0.8, probabilities };
      }
      const notes = state.notes ?? [];
      for (let index = 0; index < notes.length; index++) {
        const chosen = notes[index]?.id === includedId;
        if (questions[`include_${index}`]) {
          answers[`include_${index}`] = { type: "noul", noul: chosen ? 0.93 : 0.08 };
        }
        if (questions[`relevance_${index}`]) {
          answers[`relevance_${index}`] = chosen ? HIGH : LOW;
        }
      }
      if (questions.classification) {
        const probabilities: Record<string, number> = {};
        const rest = 0.2 / (INBOX_CLASS_VOCABULARY.length - 1);
        for (const entry of INBOX_CLASS_VOCABULARY) {
          probabilities[entry.id] = entry.id === "idea" ? 0.8 : rest;
        }
        answers.classification = {
          type: "choice",
          choice: "idea",
          confidence: 0.72,
          probabilities,
        };
      }
      for (const entry of CAPTURE_TAG_VOCABULARY) {
        const key = `tag_${entry.tag}`;
        if (questions[key]) {
          answers[key] = { type: "noul", noul: entry.tag === "idea" ? 0.81 : 0.1 };
        }
      }
      return {
        model: "jev-test",
        usage: { input_tokens: 1, output_tokens: 1 },
        answers,
      } as SystemOneResult<Q>;
    },
  };
}

let chatStore: MemoryChatStore;
const codexCalls: CodexTurnRequest[] = [];

async function createNote(title: string, body: string): Promise<string> {
  const response = await handleCreateNote(
    new Request("http://localhost/api/notes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, body }),
    }),
  );
  expect(response.status).toBe(201);
  return ((await response.json()) as { note: { id: string } }).note.id;
}

async function createThread(title?: string): Promise<string> {
  const response = await handleCreateThread(
    new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(title === undefined ? {} : { title }),
    }),
  );
  expect(response.status).toBe(201);
  return ((await response.json()) as { thread: { id: string; title: string } }).thread.id;
}

function postMessage(threadId: string, body: Record<string, unknown>) {
  return handlePostMessage(
    threadId,
    new Request(`http://localhost/api/chat/${threadId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  process.env.TYPESAFE_API_KEY = "test-key-not-used-with-mock";
  delete process.env.TYPESAFE_PROD_API_KEY;
  delete process.env.CODEX_API_KEY;
  delete process.env.OPENAI_API_KEY;
  process.env.CODEX_HOME = "/tmp/second-brain-no-codex-auth";
  chatStore = new MemoryChatStore();
  codexCalls.length = 0;
  setNotesStoreForTests(new MemoryNotesStore());
  setChatStoreForTests(chatStore);
  setSearchIndexForTests(new MemorySearchIndex());
  setSystemOneInvokerForTests(chatInvoker());
  setCodexGeneratorForTests({
    async generate(input) {
      codexCalls.push(input);
      return {
        text: `Using ${input.notes.map((note) => note.noteId).join(",")}.`,
        proposal:
          input.route === "propose_edit" ? { title: "Proposed title", body: "Proposed body" } : null,
      };
    },
    async organize() {
      return { title: "Organized title", body: "Organized body" };
    },
  });
});

afterEach(() => {
  setSystemOneInvokerForTests(null);
  setCodexGeneratorForTests(null);
  delete process.env.TYPESAFE_API_KEY;
  delete process.env.TYPESAFE_PROD_API_KEY;
  delete process.env.CODEX_HOME;
  resetNotesRuntimeForTests();
  resetChatRuntimeForTests();
  resetSearchRuntimeForTests();
});

describe("chat threads", () => {
  it("creates, lists, reads, and soft-archives a thread", async () => {
    const created = await handleCreateThread(
      new Request("http://localhost/api/chat/threads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(created.status).toBe(201);
    const thread = ((await created.json()) as { thread: { id: string; title: string; archivedAt: null } }).thread;
    expect(thread.title).toBe("");
    expect(thread.archivedAt).toBeNull();

    const listed = await handleListThreads(new Request("http://localhost/api/chat/threads?limit=1"));
    expect(listed.status).toBe(200);
    const listBody = (await listed.json()) as { threads: { id: string }[]; nextCursor: string | null };
    expect(listBody.threads.map((row) => row.id)).toEqual([thread.id]);

    const view = await handleGetThread(thread.id, new Request(`http://localhost/api/chat/${thread.id}`));
    expect(view.status).toBe(200);
    expect(((await view.json()) as { messages: unknown[] }).messages).toEqual([]);

    const archived = await handleArchiveThread(thread.id);
    expect(archived.status).toBe(200);
    expect(((await archived.json()) as { thread: { archivedAt: string } }).thread.archivedAt).toBeTruthy();
    const after = await handleListThreads(new Request("http://localhost/api/chat"));
    expect(((await after.json()) as { threads: unknown[] }).threads).toEqual([]);
  });
});

describe("chat turns", () => {
  it("cites the Jev-included note and does not cite the keyword lookalike", async () => {
    const keyword = await createNote("alpha zebra", "alpha alpha alpha");
    const judged = await createNote("boats", "no shared tokens with the question");
    setSystemOneInvokerForTests(chatInvoker({ includedId: judged }));
    const threadId = await createThread("Ask");
    const response = await postMessage(threadId, {
      content: "alpha zebra please",
      candidateNoteIds: [keyword, judged],
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      ok: true;
      assistantMessage: {
        body: string;
        content: string;
        citations: { noteId: string; title: string }[];
        sources: { noteId: string }[];
      };
      judgments: { route: { type: string; choice: string }; context: { selectedNoteIds: string[] } };
      routing: { choice: string };
      selectedNoteIds: string[];
      contextLimit: { noteCount: number; tokenCount: number; maxNotes: number; maxTokens: number };
      proposal: null;
    };
    expect(body.assistantMessage.citations.map((citation) => citation.noteId)).toEqual([judged]);
    expect(body.assistantMessage.sources.map((source) => source.noteId)).toEqual([judged]);
    expect(body.assistantMessage.citations.length).toBeGreaterThanOrEqual(1);
    expect(body.assistantMessage.body).toBe(body.assistantMessage.content);
    expect(body.selectedNoteIds).toEqual([judged]);
    expect(body.routing.choice).toBe("answer");
    expect(body.judgments.route.type).toBe("choice");
    expect(body.contextLimit.noteCount).toBe(1);
    expect(body.contextLimit.tokenCount).toBeLessThanOrEqual(body.contextLimit.maxTokens);
    expect(body.proposal).toBeNull();
    expect(JSON.stringify(body)).not.toContain("CODEX_PROMPT_SECRET");
    expect(codexCalls).toHaveLength(1);
    expect(codexCalls[0]?.notes.map((note) => note.noteId)).toEqual([judged]);
    const note = await handleGetNote(keyword);
    expect(((await note.json()) as { note: { body: string } }).note.body).toBe("alpha alpha alpha");
  });

  it("refuses an assistant reply when Jev includes no note", async () => {
    const keyword = await createNote("alpha zebra", "alpha alpha alpha");
    setSystemOneInvokerForTests(chatInvoker({ includedId: null }));
    const threadId = await createThread("Ask");
    const response = await postMessage(threadId, {
      body: "alpha zebra",
      candidateNoteIds: [keyword],
    });
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ ok: false, code: "citations_required" });
    expect(codexCalls).toHaveLength(0);
    const messages = await handleListMessages(threadId, new Request(`http://localhost/api/chat/${threadId}/messages`));
    const listed = (await messages.json()) as { messages: { role: string }[] };
    expect(listed.messages.map((message) => message.role)).toEqual(["user"]);
  });

  it("fails closed when TypeSafe is misconfigured or the judgment call fails", async () => {
    const noteId = await createNote("Ownership", "The operator owns uploaded notes.");
    const threadId = await createThread("Ask");

    delete process.env.TYPESAFE_API_KEY;
    setSystemOneInvokerForTests(null);
    const missing = await postMessage(threadId, { body: "Who owns the notes?", candidateNoteIds: [noteId] });
    expect(missing.status).toBe(503);
    expect(await missing.json()).toEqual({ ok: false, code: "typesafe_misconfigured" });

    process.env.TYPESAFE_API_KEY = "same-key";
    process.env.TYPESAFE_PROD_API_KEY = "same-key";
    const identical = await postMessage(threadId, { body: "Who owns the notes?", candidateNoteIds: [noteId] });
    expect(identical.status).toBe(503);
    expect(await identical.json()).toEqual({ ok: false, code: "typesafe_misconfigured" });

    process.env.TYPESAFE_API_KEY = "test-key-not-used-with-mock";
    delete process.env.TYPESAFE_PROD_API_KEY;
    setSystemOneInvokerForTests(chatInvoker({ includedId: noteId, fail: true }));
    const failed = await postMessage(threadId, { body: "Who owns the notes?", candidateNoteIds: [noteId] });
    expect(failed.status).toBe(502);
    expect(await failed.json()).toEqual({ ok: false, code: "judgment_failed" });
    expect(codexCalls).toHaveLength(0);
    const messages = await handleListMessages(threadId, new Request(`http://localhost/api/chat/${threadId}/messages`));
    const roles = ((await messages.json()) as { messages: { role: string }[] }).messages.map((message) => message.role);
    expect(roles.every((role) => role === "user")).toBe(true);
  });

  it("fails closed when Codex auth is not configured", async () => {
    const noteId = await createNote("Ownership", "The operator owns uploaded notes.");
    setSystemOneInvokerForTests(chatInvoker({ includedId: noteId }));
    setCodexGeneratorForTests(null);
    const threadId = await createThread("Ask");
    const response = await postMessage(threadId, { body: "Who owns the notes?", candidateNoteIds: [noteId] });
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ ok: false, code: "codex_failed" });
    const messages = await handleListMessages(
      threadId,
      new Request(`http://localhost/api/chat/${threadId}/messages`),
    );
    const listed = (await messages.json()) as { messages: { role: string; body: string }[] };
    expect(listed.messages.map((message) => message.role)).toEqual(["user"]);
    expect(listed.messages.some((message) => message.body.includes("The operator owns"))).toBe(false);
  });

  it("returns codex_failed without an assistant message when generation fails", async () => {
    const noteId = await createNote("Ownership", "The operator owns uploaded notes.");
    setSystemOneInvokerForTests(chatInvoker({ includedId: noteId }));
    setCodexGeneratorForTests({
      async generate() {
        throw new Error("codex down");
      },
    });
    const threadId = await createThread("Ask");
    const response = await postMessage(threadId, { body: "Who owns the notes?", candidateNoteIds: [noteId] });
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ ok: false, code: "codex_failed" });
    const messages = await handleListMessages(threadId, new Request(`http://localhost/api/chat/${threadId}/messages`));
    expect(((await messages.json()) as { messages: { role: string }[] }).messages.map((message) => message.role)).toEqual([
      "user",
    ]);
  });

  it("rejects streaming before saving a turn", async () => {
    const threadId = await createThread("Ask");
    const response = await postMessage(threadId, { body: "Hello", stream: true });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, code: "streaming_unsupported" });
    const messages = await handleListMessages(threadId, new Request(`http://localhost/api/chat/${threadId}/messages`));
    expect(((await messages.json()) as { messages: unknown[] }).messages).toEqual([]);
  });

  it("retrieves with E4 search and still lets Jev decide the citation", async () => {
    const owned = await createNote("Note ownership", "Uploaded notes belong to the operator.");
    await createNote("Kimchi", "Simmer kimchi with tofu.");
    setSystemOneInvokerForTests(chatInvoker({ includedId: owned }));
    const threadId = await createThread("Ask");
    const response = await postMessage(threadId, { body: "ownership" });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { assistantMessage: { citations: { noteId: string }[] } };
    expect(body.assistantMessage.citations.map((citation) => citation.noteId)).toEqual([owned]);
  });

  it("stores a proposal for propose_edit and patches the note only on approve", async () => {
    const noteId = await createNote("Old title", "Old body");
    setSystemOneInvokerForTests(chatInvoker({ route: "propose_edit", includedId: noteId }));
    const threadId = await createThread("Edit");
    const response = await postMessage(threadId, { body: "Rewrite this note", candidateNoteIds: [noteId] });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      proposal: { proposalId: string; status: string; noteId: string };
      assistantMessage: { citations: { noteId: string }[] };
    };
    expect(body.proposal.status).toBe("pending_approval");
    expect(body.proposal.noteId).toBe(noteId);
    expect(body.assistantMessage.citations).toHaveLength(1);
    const before = await handleGetNote(noteId);
    expect(((await before.json()) as { note: { title: string; body: string } }).note).toMatchObject({
      title: "Old title",
      body: "Old body",
    });

    const pending = await handleListProposals(new Request("http://localhost/api/chat/proposals?status=pending"));
    const proposals = ((await pending.json()) as { proposals: { id: string; status: string }[] }).proposals;
    expect(proposals).toEqual([expect.objectContaining({ id: body.proposal.proposalId, status: "pending" })]);

    const approved = await handleApproveProposal(body.proposal.proposalId);
    expect(approved.status).toBe(200);
    const approval = (await approved.json()) as {
      decision: { decision: string };
      note: { title: string; body: string };
    };
    expect(approval.decision).toEqual({ proposalId: body.proposal.proposalId, decision: "approve" });
    expect(approval.note).toMatchObject({ title: "Proposed title", body: "Proposed body" });
    const again = await handleApproveProposal(body.proposal.proposalId);
    expect(again.status).toBe(409);
    expect(await again.json()).toEqual({ ok: false, code: "proposal_not_pending" });
  });

  it("rejects a proposal without changing the note", async () => {
    const noteId = await createNote("Keep", "Stay");
    setSystemOneInvokerForTests(chatInvoker({ includedId: noteId }));
    const threadId = await createThread("Edit");
    const posted = await postMessage(threadId, { body: "Hello", candidateNoteIds: [noteId] });
    expect(posted.status).toBe(200);
    const messageId = ((await posted.json()) as { userMessage: { id: string } }).userMessage.id;
    setSystemOneInvokerForTests(chatInvoker({ includedId: noteId }));
    const proposed = await handleProposeEdit(
      threadId,
      new Request(`http://localhost/api/chat/${threadId}/propose-edit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          noteId,
          messageId,
          proposedTitle: "Nope",
          proposedBody: "Do not write",
        }),
      }),
    );
    expect(proposed.status).toBe(201);
    const proposalId = ((await proposed.json()) as { proposal: { proposalId: string; status: string } }).proposal
      .proposalId;
    const rejected = await handleRejectProposal(proposalId);
    expect(rejected.status).toBe(200);
    expect(((await rejected.json()) as { decision: { decision: string } }).decision.decision).toBe("reject");
    const note = await handleGetNote(noteId);
    expect(((await note.json()) as { note: { title: string; body: string } }).note).toMatchObject({
      title: "Keep",
      body: "Stay",
    });
  });

  it("honors a none route by skipping Codex", async () => {
    const noteId = await createNote("Ownership", "The operator owns uploaded notes.");
    setSystemOneInvokerForTests(chatInvoker({ route: "none", includedId: noteId }));
    const threadId = await createThread("Ask");
    const response = await postMessage(threadId, { body: "Who owns the notes?", candidateNoteIds: [noteId] });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { assistantMessage: null; proposal: null; routing: { choice: string } };
    expect(body.assistantMessage).toBeNull();
    expect(body.proposal).toBeNull();
    expect(body.routing.choice).toBe("none");
    expect(codexCalls).toHaveLength(0);
  });

  it("purges ai logs older than 7 days and keeps them off the message API", async () => {
    const noteId = await createNote("Ownership", "The operator owns uploaded notes.");
    setSystemOneInvokerForTests(chatInvoker({ includedId: noteId }));
    const threadId = await createThread("Ask");
    const first = await postMessage(threadId, { body: "Who owns the notes?", candidateNoteIds: [noteId] });
    expect(first.status).toBe(200);
    const old = [...chatStore.logs.values()][0];
    expect(old?.payload.codexPrompt).toContain("CODEX_PROMPT_SECRET");
    if (old) {
      old.createdAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    }
    const second = await postMessage(threadId, { body: "Who owns the notes again?", candidateNoteIds: [noteId] });
    expect(second.status).toBe(200);
    expect([...chatStore.logs.values()].some((log) => log.id === old?.id)).toBe(false);
    expect(JSON.stringify(await second.json())).not.toContain("CODEX_PROMPT_SECRET");
  });
});

describe("manage suggest", () => {
  it("returns Jev tags and a Codex draft without patching the note", async () => {
    const noteId = await createNote("Rough", "needs a cleanup");
    const response = await handleManageSuggest(
      new Request("http://localhost/api/chat/manage/suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ noteId }),
      }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      tags: { tag: string }[];
      proposal: { proposalId: string; status: string } | null;
      organize: { title: string };
    };
    expect(body.tags.map((tag) => tag.tag)).toContain("idea");
    expect(body.proposal?.status).toBe("pending_approval");
    expect(body.organize.title).toBe("Organized title");
    const note = await handleGetNote(noteId);
    expect(((await note.json()) as { note: { title: string } }).note.title).toBe("Rough");
    const threads = await handleListThreads(new Request("http://localhost/api/chat"));
    expect(((await threads.json()) as { threads: unknown[] }).threads).toEqual([]);
  });
});

describe("chat store citation guard", () => {
  it("refuses to store an assistant message with no citations", async () => {
    await expect(
      chatStore.createMessage({
        threadId: "missing",
        role: "assistant",
        content: "no sources",
        citations: [],
        routing: null,
      }),
    ).rejects.toBeInstanceOf(CitationsRequiredError);
  });
});
