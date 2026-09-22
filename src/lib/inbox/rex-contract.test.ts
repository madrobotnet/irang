import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { proposalAfterSuggest } from "./draft";
import {
  discardInbox,
  listInbox,
  listIngestFailures,
  promoteInbox,
  retryIngest,
  suggestInbox,
} from "./client-api";
import { MemoryNotesStore } from "@/server/notes/memory-store";
import {
  handleCapture,
  handleDiscardInbox,
  handleInboxCommand,
  handleListInbox,
  handleListNotes,
  handlePromoteInbox,
} from "@/server/notes/http";
import { resetNotesRuntimeForTests, setNotesStoreForTests } from "@/server/notes/runtime";
import { mockClassificationAnswer, mockSystemOneInvoker } from "@/server/typesafe/test-helpers";
import { setSystemOneInvokerForTests } from "@/server/typesafe/runtime";

let attachDir = "";

beforeEach(async () => {
  attachDir = await mkdtemp(path.join(os.tmpdir(), "sb-inbox-"));
  process.env.ATTACHMENTS_DIR = attachDir;
  process.env.TYPESAFE_API_KEY = "test-key-not-used-with-mock";
  setSystemOneInvokerForTests(
    mockSystemOneInvoker({
      tag_idea: { type: "noul", noul: 0.81 },
      classification: mockClassificationAnswer("idea", 0.77),
    }),
  );
  setNotesStoreForTests(new MemoryNotesStore());
});

afterEach(async () => {
  setSystemOneInvokerForTests(null);
  resetNotesRuntimeForTests();
  delete process.env.TYPESAFE_API_KEY;
  delete process.env.ATTACHMENTS_DIR;
  delete process.env.URL_SUMMARY_FORCE_FAIL;
  vi.unstubAllGlobals();
  if (attachDir) await rm(attachDir, { recursive: true, force: true });
});

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return `${input.pathname}${input.search}`;
  return `${new URL(input.url).pathname}${new URL(input.url).search}`;
}

const rexFetch: typeof fetch = async (input, init) => {
  const url = requestUrl(input);
  const method = (init?.method ?? "GET").toUpperCase();
  if (url.startsWith("/api/inbox") && method === "GET") {
    return handleListInbox(new Request(`http://localhost${url}`));
  }
  if (url === "/api/inbox" && method === "POST") {
    return handleInboxCommand(
      new Request("http://localhost/api/inbox", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: init?.body,
      }),
    );
  }
  const promote = url.match(/^\/api\/inbox\/([^/]+)\/promote$/);
  if (promote && method === "POST") {
    return handlePromoteInbox(decodeURIComponent(promote[1]));
  }
  const discard = url.match(/^\/api\/inbox\/([^/]+)\/discard$/);
  if (discard && method === "POST") {
    return handleDiscardInbox(decodeURIComponent(discard[1]));
  }
  return new Response(JSON.stringify({ ok: false, code: "not_found" }), { status: 404 });
};

function capture(body: Record<string, unknown>) {
  return handleCapture(
    new Request("http://localhost/api/capture", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("inbox client against Rex handlers", () => {
  it("lists, refreshes suggestions, promotes without copying tags, and discards", async () => {
    const captured = await capture({ title: "캡처", body: "본문 원문", target: "inbox" });
    expect(captured.status).toBe(201);
    const second = await capture({ title: "버릴 것", body: "삭제", target: "inbox" });
    expect(second.status).toBe(201);

    const listed = await listInbox(rexFetch);
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.items.map((item) => item.title).sort()).toEqual(["버릴 것", "캡처"]);
    const capturedRow = listed.items.find((item) => item.title === "캡처");
    const discardRow = listed.items.find((item) => item.title === "버릴 것");
    expect(capturedRow?.suggestions?.tags.map((tag) => tag.tag)).toContain("idea");
    expect(capturedRow?.suggestions?.classification?.choice).toBe("idea");
    if (!capturedRow || !discardRow) return;

    const calls: string[] = [];
    const countingFetch: typeof fetch = async (input, init) => {
      calls.push(`${(init?.method ?? "GET").toUpperCase()} ${requestUrl(input)}`);
      return rexFetch(input, init);
    };
    const suggested = await suggestInbox(capturedRow.id, countingFetch);
    expect(suggested.ok).toBe(true);
    if (!suggested.ok) return;
    expect(suggested.item.title).toBe("캡처");
    expect(suggested.item.suggestions?.tags.map((tag) => tag.tag)).toEqual(["idea"]);
    expect(calls).toEqual([`POST /api/inbox`]);
    const proposal = proposalAfterSuggest(capturedRow, suggested);
    expect(proposal?.mode).toBe("suggest");
    expect(proposal?.selectedTags).toEqual([]);
    expect(proposal?.title).toBe("캡처");

    const promoted = await promoteInbox(capturedRow.id, rexFetch);
    expect(promoted.ok).toBe(true);
    if (!promoted.ok) return;
    const notes = await handleListNotes(new Request("http://localhost/api/notes"));
    const noteList = (await notes.json()) as { notes: Record<string, unknown>[] };
    const note = noteList.notes.find((row) => row.id === promoted.noteId);
    expect(note?.title).toBe("캡처");
    expect(note?.body).toBe("본문 원문");
    expect(note).not.toHaveProperty("tags");
    expect(note).not.toHaveProperty("suggestions");

    const discarded = await discardInbox(discardRow.id, rexFetch);
    expect(discarded).toEqual({ ok: true });

    const after = await listInbox(rexFetch);
    expect(after).toEqual({ ok: true, items: [] });
  });

  it("does not surface stored tags when suggest returns judgment_failed", async () => {
    const store = new MemoryNotesStore();
    setNotesStoreForTests(store);
    const item = await store.createInboxItem({
      title: "Keep",
      body: "Existing suggestion stays on the server",
      source: "api",
      url: null,
      suggestions: {
        tags: [{ tag: "idea", probability: 0.9 }],
        classification: {
          ...mockClassificationAnswer("idea", 0.9),
          choice: "idea",
          probability: 0.9,
          confidence: 0.9,
        },
        judgedAt: "2026-09-22T00:00:00.000Z",
      },
    });
    setSystemOneInvokerForTests({
      async systemOne() {
        throw new Error("upstream down");
      },
    });

    const result = await suggestInbox(item.id, rexFetch);
    expect(result).toEqual({ ok: false, reason: "jev_error" });
    const proposal = proposalAfterSuggest(
      {
        id: item.id,
        title: item.title,
        body: item.body,
        source: item.source,
        url: item.url,
        createdAt: item.createdAt,
        promotedNoteId: null,
        discardedAt: null,
        suggestions: {
          tags: [{ tag: "idea", probability: 0.9 }],
          classification: { choice: "idea", probability: 0.9, confidence: 0.9 },
          judgedAt: "2026-09-22T00:00:00.000Z",
        },
      },
      result,
    );
    expect(proposal?.tags).toEqual([]);
    expect(proposal?.jevError).toBe("jev_error");
    expect((await store.getInboxItemById(item.id))?.suggestions?.tags).toEqual([
      { tag: "idea", probability: 0.9 },
    ]);
  });

  it("lists a failed ingest job and retries it into an inbox row", async () => {
    process.env.URL_SUMMARY_FORCE_FAIL = "1";
    const failed = await capture({
      title: "링크",
      body: "original",
      target: "inbox",
      url: "https://example.com/link",
    });
    expect(failed.status).toBe(502);
    delete process.env.URL_SUMMARY_FORCE_FAIL;

    const jobs = await listIngestFailures(rexFetch);
    expect(jobs.ok).toBe(true);
    if (!jobs.ok) return;
    expect(jobs.jobs).toHaveLength(1);
    expect(jobs.jobs[0]).toMatchObject({ title: "링크", detail: "forced_fail" });

    vi.stubGlobal(
      "fetch",
      async () =>
        new Response("Short summary", {
          status: 200,
          headers: { "content-type": "text/plain" },
        }),
    );
    const retried = await retryIngest(jobs.jobs[0]!.id, rexFetch);
    expect(retried).toEqual({ ok: true });

    const listed = await listInbox(rexFetch);
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.items.map((item) => item.title)).toEqual(["링크"]);
    expect(listed.items[0]?.body).toBe("Short summary");
    expect(listed.items[0]?.suggestions?.tags.map((tag) => tag.tag)).toEqual(["idea"]);
    expect(listed.items[0]).not.toHaveProperty("tags");

    const remaining = await listIngestFailures(rexFetch);
    expect(remaining).toEqual({ ok: true, jobs: [] });
  });
});
