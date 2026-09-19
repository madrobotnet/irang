import { describe, expect, it } from "vitest";
import { CAPTURE_MAX_BYTES, validateCaptureFile } from "./validation";

function file(name: string, size: number): File {
  return new File([new Uint8Array(Math.min(size, 8))], name, {
    type: "application/octet-stream",
  });
}

describe("validateCaptureFile", () => {
  it("accepts whitelisted extensions", () => {
    expect(validateCaptureFile(file("note.md", 100))).toEqual({ ok: true });
    expect(validateCaptureFile(file("pic.png", 100))).toEqual({ ok: true });
  });

  it("rejects unknown extension", () => {
    expect(validateCaptureFile(file("virus.exe", 100))).toEqual({
      ok: false,
      reason: "mime",
    });
  });

  it("rejects oversize files", () => {
    const big = file("big.zip", CAPTURE_MAX_BYTES + 1);
    Object.defineProperty(big, "size", { value: CAPTURE_MAX_BYTES + 1 });
    expect(validateCaptureFile(big)).toEqual({ ok: false, reason: "size" });
  });

  it("allows no file", () => {
    expect(validateCaptureFile(null)).toEqual({ ok: true });
  });
});
