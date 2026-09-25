import { describe, expect, it } from "vitest";
import { loadHomeSummary, loadInboxPreview } from "./home-client";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const note = {
  id: "n1",
  title: "아침",
  updatedAt: "2026-09-23T01:02:00.000Z",
};

describe("home summary client", () => {
  it("returns ready, empty, and error models from the summary response", async () => {
    const ready = await loadHomeSummary(async () =>
      jsonResponse(200, {
        ok: true,
        state: "ready",
        inboxBadge: { count: 2 },
        recentNotes: [note],
      }),
    );
    expect(ready).toMatchObject({
      ok: true,
      state: "ready",
      inboxBadge: { count: 2 },
      recentNotes: [note],
    });
    if (ready.state === "ready") {
      expect(ready.top3.map((target) => target.href)).toEqual(["/search", "/inbox", "/chat"]);
    }

    const empty = await loadHomeSummary(async () =>
      jsonResponse(200, { ok: true, state: "empty_vault", inboxBadge: { count: 0 } }),
    );
    expect(empty).toMatchObject({ ok: true, state: "empty_vault", inboxBadge: { count: 0 } });
    expect(empty).not.toHaveProperty("recentNotes");

    const failed = await loadHomeSummary(async () =>
      jsonResponse(500, { ok: false, code: "summary_failed" }),
    );
    expect(failed).toEqual({ state: "error", error: { ok: false, code: "summary_failed" } });

    const unauthorized = await loadHomeSummary(async () =>
      jsonResponse(401, { ok: false, authenticated: false, code: "unauthorized" }),
    );
    expect(unauthorized).toEqual({
      state: "error",
      error: { ok: false, code: "unauthorized" },
    });

    const missing = await loadHomeSummary(async () => new Response("missing", { status: 404 }));
    expect(missing).toEqual({ state: "error", error: { ok: false, code: "summary_failed" } });

    const offline = await loadHomeSummary(async () => {
      throw new Error("offline");
    });
    expect(offline).toEqual({ state: "error", error: { ok: false, code: "summary_failed" } });
  });

  it("keeps three open inbox rows and drops the preview when the list fails", async () => {
    const item = (id: string, title: string) => ({
      id,
      title,
      body: `${title} 본문`,
      source: "web",
      url: null,
      createdAt: "2026-09-23T01:02:00.000Z",
      promotedNoteId: null,
      discardedAt: null,
      suggestions: null,
    });
    const rows = await loadInboxPreview(async () =>
      jsonResponse(200, {
        ok: true,
        inboxItems: [
          item("i1", "하나"),
          { ...item("i2", "폐기"), discardedAt: "2026-09-23T02:00:00.000Z" },
          item("i3", "둘"),
          item("i4", "셋"),
          item("i5", "넷"),
        ],
      }),
    );
    expect(rows).toEqual([
      { id: "i1", title: "하나", summary: "하나 본문" },
      { id: "i3", title: "둘", summary: "둘 본문" },
      { id: "i4", title: "셋", summary: "셋 본문" },
    ]);

    const failed = await loadInboxPreview(async () => {
      throw new Error("down");
    });
    expect(failed).toEqual([]);
  });
});
