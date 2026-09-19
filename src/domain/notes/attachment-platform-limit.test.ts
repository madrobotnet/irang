import { describe, expect, it } from "vitest";
import nextConfig from "../../../next.config";
import {
  ATTACHMENT_UPLOAD_BODY_SIZE_LIMIT,
  ATTACHMENT_UPLOAD_BODY_SIZE_MIN_BYTES,
} from "./attachment-platform-limit";

const HUNDRED_MB = 100 * 1024 * 1024;

describe("attachment upload platform body limit (E2-U3)", () => {
  it("documents middlewareClientMaxBodySize >= 100mb for /api/attachments", () => {
    expect(ATTACHMENT_UPLOAD_BODY_SIZE_LIMIT).toBe("102mb");
    expect(ATTACHMENT_UPLOAD_BODY_SIZE_MIN_BYTES).toBe(HUNDRED_MB);
    expect(nextConfig.experimental?.middlewareClientMaxBodySize).toBe(
      ATTACHMENT_UPLOAD_BODY_SIZE_LIMIT,
    );
  });
});
