import { describe, expect, it } from "vitest";
import { candidateNoteIds, readChatQuery, scopeHref } from "./scope";

describe("chat scope query", () => {
  it("defaults to evidence ids from the E4 handoff", () => {
    const query = readChatQuery(new URLSearchParams("evidence=note-1&evidence=note-2"));
    expect(query.scope).toBe("evidence");
    expect(query.evidenceIds).toEqual(["note-1", "note-2"]);
    expect(candidateNoteIds(query)).toEqual(["note-1", "note-2"]);
  });

  it("honors scope=all even when evidence ids are present", () => {
    const params = new URLSearchParams("evidence=note-1&scope=all");
    const query = readChatQuery(params);
    expect(query.scope).toBe("all");
    expect(query.evidenceIds).toEqual(["note-1"]);
    expect(candidateNoteIds(query)).toBeUndefined();
    expect(scopeHref(params, "selected")).toBe("/chat?evidence=note-1&scope=selected");
  });

  it("uses the current note and selected ids", () => {
    const current = readChatQuery(new URLSearchParams("scope=current&note=note-9"));
    expect(current.currentNoteId).toBe("note-9");
    expect(candidateNoteIds(current)).toEqual(["note-9"]);

    const selected = readChatQuery(new URLSearchParams("scope=selected&selected=a&selected=b"));
    expect(candidateNoteIds(selected)).toEqual(["a", "b"]);
  });
});
