import { describe, expect, it } from "vitest";
import nextConfig from "../../../next.config";
import {
  ATTACHMENT_UPLOAD_BODY_SIZE_FLOOR,
  ATTACHMENT_UPLOAD_BODY_SIZE_LIMIT,
  ATTACHMENT_UPLOAD_BODY_SIZE_MIN_BYTES,
} from "./attachment-platform-limit";

const HUNDRED_MB = 100 * 1024 * 1024;

function mebibytes(limit: string): number {
  const match = /^(\d+)mb$/u.exec(limit);
  if (!match?.[1]) {
    throw new Error(`unexpected body limit ${limit}`);
  }
  return Number(match[1]);
}

describe("attachment upload platform body limit (E2-U3)", () => {
  it("documents middlewareClientMaxBodySize >= 101mb for /api/attachments", () => {
    expect(ATTACHMENT_UPLOAD_BODY_SIZE_LIMIT).toBe("102mb");
    expect(ATTACHMENT_UPLOAD_BODY_SIZE_FLOOR).toBe("101mb");
    expect(mebibytes(ATTACHMENT_UPLOAD_BODY_SIZE_LIMIT)).toBeGreaterThanOrEqual(
      mebibytes(ATTACHMENT_UPLOAD_BODY_SIZE_FLOOR),
    );
    expect(ATTACHMENT_UPLOAD_BODY_SIZE_MIN_BYTES).toBe(HUNDRED_MB);
    expect(nextConfig.experimental?.middlewareClientMaxBodySize).toBe(
      ATTACHMENT_UPLOAD_BODY_SIZE_LIMIT,
    );
  });
});
