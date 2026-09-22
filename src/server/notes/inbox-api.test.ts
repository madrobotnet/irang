import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { InboxClassId, InboxClassification } from "@/domain/inbox/classification";
import { E3_DEV_GATES } from "@/domain/inbox/dev-process-gates";
import { E3_PROTECTED_API_ROUTES } from "@/lib/auth/e3-gate-paths";
import { middleware } from "@/middleware";
import { mockClassificationAnswer, mockSystemOneInvoker } from "@/server/typesafe/test-helpers";
import { setSystemOneInvokerForTests } from "@/server/typesafe/runtime";
import type { SystemOneInvoker } from "@/server/typesafe/ports";
import {
  handleCapture,
  handleDiscardInbox,
  handleInboxCommand,
  handleListInbox,
  handleListNotes,
  handlePromoteInbox,
} from "./http";
import { MemoryNotesStore } from "./memory-store";
import { resetNotesRuntimeForTests, setNotesStoreForTests } from "./runtime";

const NOTE_KEYS = [
  "body",
  "createdAt",
  "deletedAt",
  "id",
  "purgeAt",
  "status",
  "title",
  "updatedAt",
].sort();

function storedClassification(choice: InboxClassId, probability: number): InboxClassification {
  const answer = mockClassificationAnswer(choice, probability);
  return {
    choice: answer.choice,
    probability: answer.probabilities[answer.choice],
    confidence: answer.confidence,
    probabilities: answer.probabilities,
  };
}

function jsonRequest(url: string, body: unknown, method = "POST"): Request {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

let calls = 0;

function countingInvoker(inner: SystemOneInvoker): SystemOneInvoker {
  return {
    async systemOne(request) {
      calls += 1;
      return inner.systemOne(request);
    },
  };
}

beforeEach(() => {
  calls = 0;
  process.env.TYPESAFE_API_KEY = "test-key-not-used-with-mock";
  setSystemOneInvokerForTests(
    countingInvoker(
      mockSystemOneInvoker({
        tag_idea: { type: "noul", noul: 0.81 },
        classification: mockClassificationAnswer("idea", 0.77),
      }),
    ),
  );
  setNotesStoreForTests(new MemoryNotesStore());
});

afterEach(() => {
  setSystemOneInvokerForTests(null);
  delete process.env.TYPESAFE_API_KEY;
  delete process.env.URL_SUMMARY_FORCE_FAIL;
  resetNotesRuntimeForTests();
  vi.unstubAllGlobals();
});

describe("E3 inbox API on Kai gate paths", () => {
  it("rejects unauthenticated requests on the registered inbox paths", async () => {
    expect([...E3_PROTECTED_API_ROUTES]).toEqual([
      "/api/inbox",
      "/api/inbox/item-id/promote",
      "/api/inbox/item-id/discard",
    ]);
    for (const path of E3_PROTECTED_API_ROUTES) {
      const response = await middleware(
        new NextRequest(`https://brain.madrobot.net${path}`, { method: "POST" }),
      );
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        ok: false,
        authenticated: false,
        code: "unauthorized",
      });
    }
  });

  it("stores capture suggestions and does not call Jev again while listing", async () => {
    expect(E3_DEV_GATES.suggestionDelivery).toBe("persist_explicit_refresh");
    expect(E3_DEV_GATES.classificationShape).toBe("choice_plus_tag_nouls");
    const created = await handleCapture(
      jsonRequest("http://localhost/api/capture", {
        title: "Inbox idea",
        body: "A suggestion only",
        target: "inbox",
      }),
    );
    expect(created.status).toBe(201);
    const captured = (await created.json()) as {
      inboxItem: { id: string; suggestions: { tags: { tag: string }[]; classification: { choice: string } } };
    };
    expect(captured.inboxItem.suggestions.classification.choice).toBe("idea");
    expect(captured.inboxItem.suggestions.tags.map((tag) => tag.tag)).toContain("idea");
    expect(captured.inboxItem).not.toHaveProperty("tags");
    const callsAfterCapture = calls;

    const list = await handleListInbox(new Request("http://localhost/api/inbox"));
    expect(list.status).toBe(200);
    const listed = (await list.json()) as {
      inboxItems: { id: string; suggestions: { classification: { choice: string } } }[];
      nextCursor: string | null;
    };
    expect(listed.inboxItems.map((item) => item.id)).toEqual([captured.inboxItem.id]);
    expect(listed.inboxItems[0]?.suggestions.classification.choice).toBe("idea");
    expect(listed.nextCursor).toBeNull();
    expect(calls).toBe(callsAfterCapture);
  });

  it("refreshes suggestions on POST /api/inbox without applying tags", async () => {
    const store = new MemoryNotesStore();
    setNotesStoreForTests(store);
    const item = await store.createInboxItem({
      title: "Triage me",
      body: "Hold this until someone approves a tag",
      source: "api",
      url: null,
    });
    expect(item.suggestions).toBeNull();
    const listBefore = await handleListInbox(new Request("http://localhost/api/inbox"));
    expect(calls).toBe(0);
    const bodyBefore = (await listBefore.json()) as { inboxItems: { suggestions: null }[] };
    expect(bodyBefore.inboxItems[0]?.suggestions).toBeNull();

    const refresh = await handleInboxCommand(
      jsonRequest("http://localhost/api/inbox", { action: "suggest", id: item.id }),
    );
    expect(refresh.status).toBe(200);
    const refreshed = (await refresh.json()) as {
      inboxItem: {
        title: string;
        suggestions: { tags: { tag: string }[]; classification: { choice: string } | null };
        tags?: unknown;
      };
    };
    expect(refreshed.inboxItem.title).toBe("Triage me");
    expect(refreshed.inboxItem.suggestions.classification?.choice).toBe("idea");
    expect(refreshed.inboxItem.suggestions.tags.map((tag) => tag.tag)).toEqual(["idea"]);
    expect(refreshed.inboxItem.tags).toBeUndefined();
    expect(calls).toBe(1);

    const again = await handleListInbox(new Request(`http://localhost/api/inbox?id=${item.id}`));
    expect(again.status).toBe(200);
    expect(calls).toBe(1);
  });

  it("returns judgment_failed and leaves stored suggestions untouched", async () => {
    const store = new MemoryNotesStore();
    setNotesStoreForTests(store);
    const item = await store.createInboxItem({
      title: "Keep",
      body: "Existing suggestion stays",
      source: "api",
      url: null,
      suggestions: {
        tags: [{ tag: "idea", probability: 0.9 }],
        classification: storedClassification("idea", 0.9),
        judgedAt: "2026-09-22T00:00:00.000Z",
      },
    });
    setSystemOneInvokerForTests({
      async systemOne() {
        throw new Error("upstream down");
      },
    });
    const refresh = await handleInboxCommand(
      jsonRequest("http://localhost/api/inbox", { action: "suggest", id: item.id }),
    );
    expect(refresh.status).toBe(502);
    expect(await refresh.json()).toEqual({ ok: false, code: "judgment_failed" });
    const current = await store.getInboxItemById(item.id);
    expect(current?.suggestions?.judgedAt).toBe("2026-09-22T00:00:00.000Z");
    expect(current?.suggestions?.tags).toEqual([{ tag: "idea", probability: 0.9 }]);
  });

  it("returns typesafe_misconfigured when the key is missing", async () => {
    const store = new MemoryNotesStore();
    setNotesStoreForTests(store);
    const item = await store.createInboxItem({
      title: "Keep",
      body: "No fallback tags",
      source: "api",
      url: null,
    });
    setSystemOneInvokerForTests(null);
    delete process.env.TYPESAFE_API_KEY;
    const refresh = await handleInboxCommand(
      jsonRequest("http://localhost/api/inbox", { action: "suggest", id: item.id }),
    );
    expect(refresh.status).toBe(503);
    const body = await refresh.json();
    expect(body).toEqual({ ok: false, code: "typesafe_misconfigured" });
    expect(JSON.stringify(body)).not.toContain("TYPESAFE_API_KEY");
    expect((await store.getInboxItemById(item.id))?.suggestions).toBeNull();
  });

  it("promotes once, rejects discard and a discarded promote, and does not copy tags onto the note", async () => {
    expect(E3_DEV_GATES.repeatPromote).toBe("idempotent_existing_note");
    expect(E3_DEV_GATES.promoteWhenDiscarded).toBe("reject_discarded");
    expect(E3_DEV_GATES.discardWhenPromoted).toBe("reject_promoted");
    const store = new MemoryNotesStore();
    setNotesStoreForTests(store);
    const item = await store.createInboxItem({
      title: "Promote me",
      body: "Body stays on the note",
      source: "web",
      url: null,
      suggestions: {
        tags: [{ tag: "idea", probability: 0.9 }],
        classification: storedClassification("idea", 0.9),
        judgedAt: "2026-09-22T00:00:00.000Z",
      },
    });
    const first = await handlePromoteInbox(item.id);
    expect(first.status).toBe(200);
    const promoted = (await first.json()) as {
      note: Record<string, unknown> & { id: string };
      inboxItem: { promotedNoteId: string; suggestions: { tags: { tag: string }[] } };
    };
    expect(promoted.inboxItem.promotedNoteId).toBe(promoted.note.id);
    expect(Object.keys(promoted.note).sort()).toEqual(NOTE_KEYS);
    expect(promoted.note).not.toHaveProperty("tags");
    expect(promoted.note).not.toHaveProperty("suggestions");
    expect(promoted.inboxItem.suggestions.tags).toEqual([{ tag: "idea", probability: 0.9 }]);

    const second = await handlePromoteInbox(item.id);
    expect(second.status).toBe(200);
    const again = (await second.json()) as { note: { id: string } };
    expect(again.note.id).toBe(promoted.note.id);
    const notes = await handleListNotes(new Request("http://localhost/api/notes"));
    const noteList = (await notes.json()) as { notes: { id: string }[] };
    expect(noteList.notes.filter((note) => note.id === promoted.note.id)).toHaveLength(1);

    const discarded = await handleDiscardInbox(item.id);
    expect(discarded.status).toBe(409);
    expect(await discarded.json()).toEqual({ ok: false, code: "already_promoted" });
    expect((await store.getInboxItemById(item.id))?.discardedAt).toBeNull();

    const closed = await store.createInboxItem({
      title: "Gone",
      body: "Do not promote",
      source: "api",
      url: null,
    });
    const discard = await handleDiscardInbox(closed.id);
    expect(discard.status).toBe(200);
    const discardedItem = (await discard.json()) as { inboxItem: { discardedAt: string } };
    const discardAgain = await handleDiscardInbox(closed.id);
    expect(discardAgain.status).toBe(200);
    const discardedAgain = (await discardAgain.json()) as { inboxItem: { discardedAt: string } };
    expect(discardedAgain.inboxItem.discardedAt).toBe(discardedItem.inboxItem.discardedAt);

    const promoteClosed = await handlePromoteInbox(closed.id);
    expect(promoteClosed.status).toBe(409);
    expect(await promoteClosed.json()).toEqual({ ok: false, code: "discarded" });
    expect((await store.getInboxItemById(closed.id))?.promotedNoteId).toBeNull();

    const open = await handleListInbox(new Request("http://localhost/api/inbox"));
    const openBody = (await open.json()) as { inboxItems: { id: string }[] };
    expect(openBody.inboxItems.map((row) => row.id)).not.toContain(item.id);
    expect(openBody.inboxItems.map((row) => row.id)).not.toContain(closed.id);
    const all = await handleListInbox(new Request("http://localhost/api/inbox?includeClosed=1"));
    const allBody = (await all.json()) as { inboxItems: { id: string }[] };
    expect(allBody.inboxItems.map((row) => row.id)).toEqual(
      expect.arrayContaining([item.id, closed.id]),
    );
  });

  it("rejects promote when the note body would be empty", async () => {
    const store = new MemoryNotesStore();
    setNotesStoreForTests(store);
    const item = await store.createInboxItem({
      title: "Title only",
      body: " ",
      source: "share",
      url: null,
    });
    const res = await handlePromoteInbox(item.id);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ ok: false, code: "validation" });
    expect((await store.listNotes({ limit: 10, includeDeleted: false })).notes).toHaveLength(0);
  });

  it("lists failed ingest jobs on GET /api/inbox?view=ingest and retries on the same path", async () => {
    expect(E3_DEV_GATES.ingestRetryTarget).toBe("honor_stored_target");
    process.env.URL_SUMMARY_FORCE_FAIL = "1";
    const failed = await handleCapture(
      jsonRequest("http://localhost/api/capture", {
        title: "Article",
        body: "ignored",
        target: "note",
        url: "https://example.com/story",
      }),
    );
    expect(failed.status).toBe(502);
    const failedBody = (await failed.json()) as { code: string; jobId: string };
    expect(failedBody.code).toBe("ingest_failed");
    delete process.env.URL_SUMMARY_FORCE_FAIL;

    const jobs = await handleListInbox(new Request("http://localhost/api/inbox?view=ingest"));
    expect(jobs.status).toBe(200);
    const jobList = (await jobs.json()) as {
      jobs: { id: string; status: string; payload: { target?: string } }[];
    };
    expect(jobList.jobs.map((job) => job.id)).toContain(failedBody.jobId);
    expect(jobList.jobs[0]?.status).toBe("failed");
    expect(jobList.jobs[0]?.payload.target).toBe("note");

    vi.stubGlobal(
      "fetch",
      async () =>
        new Response("Summarized article text", {
          status: 200,
          headers: { "content-type": "text/plain" },
        }),
    );
    const retried = await handleInboxCommand(
      jsonRequest("http://localhost/api/inbox", { action: "retry", id: failedBody.jobId }),
    );
    expect(retried.status).toBe(200);
    const retryBody = (await retried.json()) as {
      target: string;
      note: Record<string, unknown> & { id: string; body: string };
      job: { status: string };
    };
    expect(retryBody.target).toBe("note");
    expect(retryBody.note.body).toBe("Summarized article text");
    expect(Object.keys(retryBody.note).sort()).toEqual(NOTE_KEYS);
    expect(retryBody.job.status).toBe("done");
    expect(JSON.stringify(retryBody)).not.toContain("test-key-not-used-with-mock");

    const second = await handleInboxCommand(
      jsonRequest("http://localhost/api/inbox", { action: "retry", id: failedBody.jobId }),
    );
    expect(second.status).toBe(409);
    expect(await second.json()).toEqual({ ok: false, code: "not_failed" });

    const one = await handleListInbox(
      new Request(`http://localhost/api/inbox?view=ingest&id=${failedBody.jobId}`),
    );
    expect(one.status).toBe(200);
    const oneBody = (await one.json()) as { job: { status: string } };
    expect(oneBody.job.status).toBe("done");
  });

  it("retries an inbox capture into an inbox item and keeps tags inside suggestions", async () => {
    process.env.URL_SUMMARY_FORCE_FAIL = "1";
    const failed = await handleCapture(
      jsonRequest("http://localhost/api/capture", {
        title: "Link",
        body: "original",
        target: "inbox",
        url: "https://example.com/link",
      }),
    );
    const { jobId } = (await failed.json()) as { jobId: string };
    delete process.env.URL_SUMMARY_FORCE_FAIL;
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response("Short summary", {
          status: 200,
          headers: { "content-type": "text/plain" },
        }),
    );
    const retried = await handleInboxCommand(
      jsonRequest("http://localhost/api/inbox", { action: "retry", id: jobId }),
    );
    expect(retried.status).toBe(200);
    const body = (await retried.json()) as {
      target: string;
      inboxItem: {
        body: string;
        suggestions: { tags: { tag: string }[]; classification: { choice: string } };
        tags?: unknown;
      };
      note?: unknown;
    };
    expect(body.target).toBe("inbox");
    expect(body.note).toBeUndefined();
    expect(body.inboxItem.body).toBe("Short summary");
    expect(body.inboxItem.tags).toBeUndefined();
    expect(body.inboxItem.suggestions.classification.choice).toBe("idea");
    expect(body.inboxItem.suggestions.tags.map((tag) => tag.tag)).toEqual(["idea"]);
    const notes = await handleListNotes(new Request("http://localhost/api/notes"));
    const noteList = (await notes.json()) as { notes: unknown[] };
    expect(noteList.notes).toHaveLength(0);
  });

  it("keeps a failed retry failed when TypeSafe is down and does not invent a note", async () => {
    const store = new MemoryNotesStore();
    setNotesStoreForTests(store);
    const job = await store.createIngestJob({
      kind: "url_summary",
      status: "failed",
      payload: { url: "https://example.com/a", title: "A", target: "note" },
      error: "forced_fail",
    });
    vi.stubGlobal(
      "fetch",
      async () => new Response("Summary ok", { status: 200, headers: { "content-type": "text/plain" } }),
    );
    setSystemOneInvokerForTests(null);
    delete process.env.TYPESAFE_API_KEY;
    const retried = await handleInboxCommand(
      jsonRequest("http://localhost/api/inbox", { action: "retry", id: job.id }),
    );
    expect(retried.status).toBe(503);
    expect(await retried.json()).toEqual({
      ok: false,
      code: "typesafe_misconfigured",
      jobId: job.id,
    });
    expect((await store.getIngestJobById(job.id))?.status).toBe("failed");
    expect((await store.getIngestJobById(job.id))?.error).toBe("typesafe_misconfigured");
    expect((await store.listNotes({ limit: 10, includeDeleted: false })).notes).toHaveLength(0);
  });

  it("refuses to retry a job that is not a url summary", async () => {
    const store = new MemoryNotesStore();
    setNotesStoreForTests(store);
    const job = await store.createIngestJob({
      kind: "upload",
      status: "failed",
      payload: {},
      error: "nope",
    });
    const retried = await handleInboxCommand(
      jsonRequest("http://localhost/api/inbox", { action: "retry", id: job.id }),
    );
    expect(retried.status).toBe(409);
    expect(await retried.json()).toEqual({ ok: false, code: "not_retriable" });
    expect((await store.getIngestJobById(job.id))?.status).toBe("failed");
  });
});
