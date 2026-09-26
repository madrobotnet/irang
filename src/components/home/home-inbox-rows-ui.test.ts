import { describe, expect, it } from "vitest";
import { loadHomeInboxRowViews } from "./home-inbox-rows-ui";

describe("home inbox row views (UI lane)", () => {
  it("maps three open inbox items for the hero list", async () => {
    const item = (id: string, title: string) => ({
      id,
      title,
      body: `${title} 본문`,
      source: "share",
      url: null,
      createdAt: "2026-09-23T01:02:00.000Z",
      promotedNoteId: null,
      discardedAt: null,
      suggestions: null,
    });
    const rows = await loadHomeInboxRowViews(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          inboxItems: [item("i1", "하나"), item("i2", "둘"), item("i3", "셋")],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ id: "i1", title: "하나", source: "share" });
  });
});
