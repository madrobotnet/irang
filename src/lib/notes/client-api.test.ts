import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createNote,
  daysUntilPurge,
  listNotes,
  submitCapture,
} from "./client-api";

describe("daysUntilPurge", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses purgeAt when provided", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-24T12:00:00Z"));
    expect(daysUntilPurge("2026-09-26T12:00:00Z", "2026-09-19T12:00:00Z")).toBe(2);
  });

  it("falls back to 7-day window from deletedAt", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-19T12:00:00Z"));
    expect(daysUntilPurge(null, "2026-09-19T12:00:00Z")).toBe(7);
  });
});

describe("notes client API (Rex envelopes)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("listNotes unwraps { ok, notes, nextCursor }", async () => {
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
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0].id).toBe("n1");
  });

  it("createNote POSTs title/body JSON", async () => {
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
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/notes",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ title: "Hi", body: "There" }),
      }),
    );
  });

  it("submitCapture sends target JSON then optional attachment", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        text: async () =>
          JSON.stringify({
            ok: true,
            target: "note",
            note: { id: "note-1" },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        text: async () => JSON.stringify({ ok: true, attachment: { id: "a1" } }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const file = new File(["# x"], "x.md", { type: "text/markdown" });
    const result = await submitCapture({
      target: "note",
      title: "Cap",
      body: "Body",
      file,
    });
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const captureCall = fetchMock.mock.calls[0];
    expect(captureCall[0]).toBe("/api/capture");
    expect(JSON.parse(captureCall[1].body as string)).toEqual({
      title: "Cap",
      body: "Body",
      target: "note",
    });
  });
});
