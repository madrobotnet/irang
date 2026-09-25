import { describe, expect, it } from "vitest";
import { HOME_TOP3_TARGETS } from "@/lib/home/dto";
import { HOME_RECENT_NOTES_LIMIT, projectHomeSummary } from "./summary";

describe("projectHomeSummary", () => {
  it("returns empty_vault with the inbox count and no recent notes", () => {
    const summary = projectHomeSummary([], 2);
    expect(summary).toEqual({
      ok: true,
      state: "empty_vault",
      top3: HOME_TOP3_TARGETS,
      inboxBadge: { count: 2 },
    });
    expect(summary).not.toHaveProperty("recentNotes");
  });

  it("returns ready for one live note", () => {
    expect(
      projectHomeSummary(
        [{ id: "note-1", title: "오늘 메모", updatedAt: "2026-09-23T00:00:00.000Z" }],
        4,
      ),
    ).toEqual({
      ok: true,
      state: "ready",
      top3: HOME_TOP3_TARGETS,
      inboxBadge: { count: 4 },
      recentNotes: [{ id: "note-1", title: "오늘 메모", updatedAt: "2026-09-23T00:00:00.000Z" }],
    });
  });

  it("caps a newest-first list at the home strip", () => {
    const notes = Array.from({ length: HOME_RECENT_NOTES_LIMIT + 2 }, (_, index) => ({
      id: `note-${index}`,
      title: `title-${index}`,
      updatedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, HOME_RECENT_NOTES_LIMIT + 1 - index)).toISOString(),
    }));
    expect(projectHomeSummary(notes, 9)).toEqual({
      ok: true,
      state: "ready",
      top3: HOME_TOP3_TARGETS,
      inboxBadge: { count: 9 },
      recentNotes: notes.slice(0, HOME_RECENT_NOTES_LIMIT),
    });
  });
});
