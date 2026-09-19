import { describe, expect, it } from "vitest";
import { applyTagSuggestions } from "./apply-tag-suggestions";

describe("applyTagSuggestions", () => {
  it("requires a capture target", async () => {
    expect(await applyTagSuggestions({ tags: ["idea"] })).toEqual({
      ok: false,
      reason: "no_target",
    });
  });

  it("accepts approved tags for note target", async () => {
    expect(await applyTagSuggestions({ tags: ["idea"], noteId: "n1" })).toEqual({ ok: true });
  });
});
