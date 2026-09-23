import { describe, expect, it } from "vitest";
import { parseProposalDraft } from "./codex";

describe("parseProposalDraft", () => {
  it("reads a fenced JSON edit draft and rejects partial drafts", () => {
    expect(
      parseProposalDraft('```json\n{"message":"Draft","title":"Next","body":"Body"}\n```'),
    ).toEqual({
      message: "Draft",
      title: "Next",
      body: "Body",
    });
    expect(parseProposalDraft('{"message":"","title":"T","body":"B"}')).toBeNull();
    expect(parseProposalDraft("not json")).toBeNull();
  });
});
