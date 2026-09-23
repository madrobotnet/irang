import { describe, expect, it } from "vitest";
import { MAX_ATTACHMENT_BYTES } from "./constants";
import { contentLengthExceedsLimit, exceedsAttachmentByteLimit } from "./attachment-limits";

describe("exceedsAttachmentByteLimit", () => {
  it("allows exactly 100MB", () => {
    expect(exceedsAttachmentByteLimit(MAX_ATTACHMENT_BYTES)).toBe(false);
  });

  it("rejects over 100MB", () => {
    expect(exceedsAttachmentByteLimit(MAX_ATTACHMENT_BYTES + 1)).toBe(true);
  });
});

describe("contentLengthExceedsLimit", () => {
  it("allows a missing header, an exact cap, and a non-numeric value", () => {
    expect(contentLengthExceedsLimit(null)).toBe(false);
    expect(contentLengthExceedsLimit(String(MAX_ATTACHMENT_BYTES))).toBe(false);
    expect(contentLengthExceedsLimit(`000${MAX_ATTACHMENT_BYTES}`)).toBe(false);
    expect(contentLengthExceedsLimit("1e9")).toBe(false);
    expect(contentLengthExceedsLimit("")).toBe(false);
  });

  it("rejects one byte over the cap, including leading zeros and oversized digit strings", () => {
    expect(contentLengthExceedsLimit(String(MAX_ATTACHMENT_BYTES + 1))).toBe(true);
    expect(contentLengthExceedsLimit(`000${MAX_ATTACHMENT_BYTES + 1}`)).toBe(true);
    expect(contentLengthExceedsLimit(` ${MAX_ATTACHMENT_BYTES + 1} `)).toBe(true);
    expect(contentLengthExceedsLimit("9".repeat(40))).toBe(true);
  });
});
