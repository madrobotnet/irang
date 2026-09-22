import { describe, expect, it } from "vitest";
import { MAX_ATTACHMENT_BYTES } from "./constants";
import { exceedsAttachmentByteLimit } from "./attachment-limits";

describe("exceedsAttachmentByteLimit", () => {
  it("allows exactly 100MB", () => {
    expect(exceedsAttachmentByteLimit(MAX_ATTACHMENT_BYTES)).toBe(false);
  });

  it("rejects over 100MB", () => {
    expect(exceedsAttachmentByteLimit(MAX_ATTACHMENT_BYTES + 1)).toBe(true);
  });
});
