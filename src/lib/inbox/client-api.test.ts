import { afterEach, describe, expect, it } from "vitest";
import { mapInboxFailure } from "./api-contract";
import {
  discardInbox,
  listInbox,
  listIngestFailures,
  promoteInbox,
  retryIngest,
  suggestInbox,
} from "./client-api";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

describe("mapInboxFailure", () => {
  it("maps judgment and key failures before generic 502", () => {
    expect(mapInboxFailure(502, "judgment_failed")).toBe("jev_error");
    expect(mapInboxFailure(502, "jev_error")).toBe("jev_error");
    expect(mapInboxFailure(503, "typesafe_misconfigured")).toBe("key_missing");
    expect(mapInboxFailure(503, "key_missing")).toBe("key_missing");
    expect(mapInboxFailure(502, "ingest_failed")).toBe("ingest_failed");
    expect(mapInboxFailure(502, undefined)).toBe("ingest_failed");
    expect(mapInboxFailure(409, "discarded")).toBe("discarded");
    expect(mapInboxFailure(409, "already_promoted")).toBe("already_promoted");
  });
});

describe("listInbox", () => {
  it("reads open inbox rows and stored suggestions", async () => {
    globalThis.fetch = async () =>
      jsonResponse(200, {
        ok: true,
        inboxItems: [
          {
            id: "a",
            title: "열린",
            body: "본문",
            source: "share",
            url: null,
            createdAt: "2026-09-22T01:00:00.000Z",
            promotedNoteId: null,
            discardedAt: null,
            suggestions: {
              tags: [{ tag: "idea", probability: 0.8 }],
              classification: { choice: "idea", probability: 0.8, confidence: 0.42 },
              judgedAt: "2026-09-22T01:00:00.000Z",
            },
          },
          {
            id: "b",
            title: "승격됨",
            body: "x",
            source: "web",
            url: null,
            createdAt: "2026-09-22T01:00:00.000Z",
            promotedNoteId: "note-1",
            discardedAt: null,
          },
          {
            id: "c",
            title: "폐기",
            body: "x",
            source: "api",
            url: null,
            createdAt: "2026-09-22T01:00:00.000Z",
            promotedNoteId: null,
            discardedAt: "2026-09-22T02:00:00.000Z",
          },
          { id: "", title: "bad", source: "web" },
        ],
      });

    const result = await listInbox();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: "a",
      title: "열린",
      source: "share",
    });
    expect(result.items[0]?.suggestions?.classification?.confidence).toBe(0.42);
    expect(result.items[0]?.suggestions?.tags.map((tag) => tag.tag)).toEqual(["idea"]);
  });

  it("maps a Jev failure on the list itself and a network failure", async () => {
    globalThis.fetch = async () => jsonResponse(502, { ok: false, code: "judgment_failed" });
    await expect(listInbox()).resolves.toEqual({ ok: false, reason: "jev_error" });

    globalThis.fetch = async () => jsonResponse(503, { ok: false, code: "typesafe_misconfigured" });
    await expect(listInbox()).resolves.toEqual({ ok: false, reason: "key_missing" });

    globalThis.fetch = async () => {
      throw new Error("offline");
    };
    await expect(listInbox()).resolves.toEqual({ ok: false, reason: "network" });
  });
});

describe("listIngestFailures", () => {
  it("reads failed jobs from the ingest view", async () => {
    const calls: string[] = [];
    globalThis.fetch = async (input) => {
      calls.push(urlOf(input));
      return jsonResponse(200, {
        ok: true,
        jobs: [
          {
            id: "job-1",
            kind: "url_summary",
            status: "failed",
            payload: { url: "https://example.com/a", title: "기사", target: "inbox" },
            error: "forced_fail",
            createdAt: "2026-09-22T01:00:00.000Z",
          },
          {
            id: "job-2",
            status: "done",
            payload: { title: "끝난" },
            error: null,
            createdAt: "2026-09-22T01:00:00.000Z",
          },
        ],
      });
    };
    const result = await listIngestFailures();
    expect(calls).toEqual(["/api/inbox?view=ingest"]);
    expect(result).toEqual({
      ok: true,
      jobs: [
        {
          id: "job-1",
          title: "기사",
          detail: "forced_fail",
          createdAt: "2026-09-22T01:00:00.000Z",
        },
      ],
    });
  });
});

describe("suggestInbox", () => {
  it("posts the suggest command and returns the refreshed row", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    globalThis.fetch = async (input, init) => {
      calls.push({ url: urlOf(input), init });
      return jsonResponse(200, {
        ok: true,
        inboxItem: {
          id: "item-1",
          title: "Triage me",
          body: "본문",
          source: "api",
          url: null,
          createdAt: "2026-09-22T01:00:00.000Z",
          promotedNoteId: null,
          discardedAt: null,
          suggestions: {
            tags: [{ tag: "idea", probability: 0.81 }],
            classification: { choice: "idea", probability: 0.77, confidence: 0.77 },
            judgedAt: "2026-09-22T02:00:00.000Z",
          },
        },
      });
    };

    const result = await suggestInbox("item-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.item.suggestions?.tags.map((tag) => tag.tag)).toEqual(["idea"]);
    expect(result.item.suggestions?.classification?.confidence).toBe(0.77);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("/api/inbox");
    expect(calls[0]?.init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ action: "suggest", id: "item-1" });
  });

  it("returns a Jev failure without tags", async () => {
    globalThis.fetch = async () => jsonResponse(502, { ok: false, code: "judgment_failed" });
    await expect(suggestInbox("item-1")).resolves.toEqual({ ok: false, reason: "jev_error" });

    globalThis.fetch = async () =>
      jsonResponse(503, { ok: false, code: "typesafe_misconfigured" });
    await expect(suggestInbox("item-1")).resolves.toEqual({ ok: false, reason: "key_missing" });
  });
});

describe("promoteInbox", () => {
  it("posts promote with no body and does not patch the note", async () => {
    const calls: { url: string; method: string; body: string | undefined }[] = [];
    globalThis.fetch = async (input, init) => {
      calls.push({
        url: urlOf(input),
        method: init?.method ?? "GET",
        body: typeof init?.body === "string" ? init.body : undefined,
      });
      return jsonResponse(200, {
        ok: true,
        inboxItem: { id: "item-1" },
        note: { id: "note-9", title: "원래", body: "원래 본문" },
      });
    };

    const result = await promoteInbox("item 1");
    expect(result).toEqual({ ok: true, noteId: "note-9" });
    expect(calls).toEqual([
      { url: "/api/inbox/item%201/promote", method: "POST", body: undefined },
    ]);
  });

  it("maps discarded promote to a promote failure", async () => {
    globalThis.fetch = async () => jsonResponse(409, { ok: false, code: "discarded" });
    await expect(promoteInbox("item-1")).resolves.toEqual({
      ok: false,
      reason: "promote_failed",
    });
  });
});

describe("discardInbox", () => {
  it("posts discard and does not promote", async () => {
    const calls: string[] = [];
    globalThis.fetch = async (input, init) => {
      calls.push(`${init?.method ?? "GET"} ${urlOf(input)}`);
      return jsonResponse(200, { ok: true, inboxItem: { id: "item-1" } });
    };
    await expect(discardInbox("item-1")).resolves.toEqual({ ok: true });
    expect(calls).toEqual(["POST /api/inbox/item-1/discard"]);
  });
});

describe("retryIngest", () => {
  it("posts the retry command and maps judgment failure", async () => {
    const calls: { url: string; body: string }[] = [];
    globalThis.fetch = async (input, init) => {
      calls.push({ url: urlOf(input), body: String(init?.body) });
      return jsonResponse(503, {
        ok: false,
        code: "typesafe_misconfigured",
        jobId: "job-1",
      });
    };
    await expect(retryIngest("job-1")).resolves.toEqual({ ok: false, reason: "key_missing" });
    expect(JSON.parse(calls[0]?.body ?? "{}")).toEqual({ action: "retry", id: "job-1" });
    expect(calls[0]?.url).toBe("/api/inbox");
  });
});
