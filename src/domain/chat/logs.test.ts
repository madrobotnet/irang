import { describe, expect, it } from "vitest";
import { aiLogExpiry } from "./limits";
import { maskAiLogPayload } from "./logs";

describe("ai log retention", () => {
  it("masks raw prompt text and expires logs after 7 days", () => {
    const masked = maskAiLogPayload({
      kind: "chat_turn",
      threadId: "thread-1",
      selectedNoteIds: ["note-1"],
      codexPrompt: "CODEX_PROMPT_SECRET do not list this",
      response: "full answer",
    });
    expect(masked.codexPrompt).toBe("[masked]");
    expect(masked.response).toBe("[masked]");
    expect(masked.kind).toBe("chat_turn");
    expect(masked.selectedNoteIds).toEqual(["note-1"]);
    expect(JSON.stringify(masked)).not.toContain("CODEX_PROMPT_SECRET");

    const now = new Date("2026-09-22T00:00:00.000Z");
    expect(aiLogExpiry(now, 7).toISOString()).toBe("2026-09-15T00:00:00.000Z");
  });
});
