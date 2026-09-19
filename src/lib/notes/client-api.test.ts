import { afterEach, describe, expect, it, vi } from "vitest";
import { mapNoteApiFailure } from "./api-contract";
import {
  createNote,
  daysUntilPurge,
  listNotes,
  NotesApiError,
  restoreNote,
  submitCapture,
} from "./client-api";

describe("mapNoteApiFailure", () => {
  it("prefers explicit Rex code", () => {
    expect(mapNoteApiFailure(502, "ingest_failed")).toBe("ingest_failed");
  });

  it("infers from HTTP when code missing", () => {
    expect(mapNoteApiFailure(401, undefined)).toBe("unauthorized");
    expect(mapNoteApiFailure(413, undefined)).toBe("payload_too_large");
    expect(mapNoteApiFailure(410, undefined)).toBe("purged");
  });
});

describe("daysUntilPurge", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses purgeAt when provided", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-24T12:00:00Z"));
    expect(daysUntilPurge("2026-09-26T12:00:00Z", "2026-09-19T12:00:00Z")).toBe(2);
  });
});

describe("notes client API (Rex envelopes)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("listNotes requires 200 and ok envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            ok: true,
            notes: [{ id: "n1", title: "T", body: "B", status: "draft" }],
            nextCursor: null,
          }),
      }),
    );
    const result = await listNotes();
    expect(result.notes[0].id).toBe("n1");
  });

  it("createNote requires 201", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      text: async () =>
        JSON.stringify({
          ok: true,
          note: {
            id: "n2",
            title: "Hi",
            body: "There",
            status: "draft",
            createdAt: "t",
            updatedAt: "t",
            deletedAt: null,
            purgeAt: null,
          },
        }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const note = await createNote({ title: "Hi", body: "There" });
    expect(note.id).toBe("n2");
  });

  it("restoreNote surfaces purged 410", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 410,
        text: async () => JSON.stringify({ ok: false, code: "purged" }),
      }),
    );
    await expect(restoreNote("x")).rejects.toMatchObject({
      code: "purged",
      status: 410,
    } satisfies Partial<NotesApiError>);
  });

  it("submitCapture maps ingest_failed 502", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        text: async () => JSON.stringify({ ok: false, code: "ingest_failed", jobId: "j1" }),
      }),
    );
    const result = await submitCapture({
      target: "note",
      title: "T",
      body: "B",
      url: "https://example.com",
    });
    expect(result).toEqual({ ok: false, reason: "ingest_failed" });
  });

  it("submitCapture honors duplicateHint on 201", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        text: async () =>
          JSON.stringify({
            ok: true,
            target: "inbox",
            inboxItem: { id: "in1" },
            duplicateHint: true,
          }),
      }),
    );
    const result = await submitCapture({ target: "inbox", title: "T", body: "B" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.duplicateHint).toBe(true);
  });
});
