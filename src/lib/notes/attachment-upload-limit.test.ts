import { describe, expect, it } from "vitest";
import {
  ATTACHMENT_MAX_REQUEST_BODY_BYTES,
  isAttachmentRequestBodyTooLarge,
  parseContentLengthHeader,
} from "./attachment-upload-limit";

describe("attachment upload body limit", () => {
  it("parses Content-Length", () => {
    const headers = new Headers({ "content-length": "42" });
    expect(parseContentLengthHeader(headers)).toBe(42);
    expect(parseContentLengthHeader(new Headers())).toBeNull();
    expect(parseContentLengthHeader(new Headers({ "content-length": "nope" }))).toBeNull();
  });

  it("flags bodies larger than allowed multipart envelope", () => {
    expect(isAttachmentRequestBodyTooLarge(ATTACHMENT_MAX_REQUEST_BODY_BYTES)).toBe(false);
    expect(isAttachmentRequestBodyTooLarge(ATTACHMENT_MAX_REQUEST_BODY_BYTES + 1)).toBe(true);
    expect(isAttachmentRequestBodyTooLarge(null)).toBe(false);
  });
});
