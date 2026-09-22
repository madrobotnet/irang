import assert from "node:assert/strict";
import { join } from "node:path";
import { it } from "node:test";
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  allowedUploadMime,
  contentLengthExceedsLimit,
  exceedsUploadLimit,
  MAX_UPLOAD_BYTES,
  storedFilename,
  uploadDirectory,
} from "../../src/lib/uploads/policy";

const REQUIRED_MIME_TYPES = [
  "text/markdown",
  "text/plain",
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/zip",
  "audio/mpeg",
  "video/mp4",
] as const;

it("caps uploads at 104857600 bytes", () => {
  // Given / When / Then
  assert.equal(MAX_UPLOAD_BYTES, 104857600);
  assert.equal(exceedsUploadLimit(104857600), false);
  assert.equal(exceedsUploadLimit(104857601), true);
  assert.equal(exceedsUploadLimit(0), false);
});

it("treats a Content-Length above 104857600 as too large and ignores non-integers", () => {
  // Given / When / Then
  assert.equal(contentLengthExceedsLimit(null), false);
  assert.equal(contentLengthExceedsLimit("104857600"), false);
  assert.equal(contentLengthExceedsLimit("104857601"), true);
  assert.equal(contentLengthExceedsLimit("000104857601"), true);
  assert.equal(contentLengthExceedsLimit("99999999999999999999"), true);
  assert.equal(contentLengthExceedsLimit("nope"), false);
  assert.equal(contentLengthExceedsLimit(""), false);
});

it("allows exactly the upload MIME allowlist", () => {
  // Given / When / Then
  assert.deepEqual([...ALLOWED_UPLOAD_MIME_TYPES].sort(), [...REQUIRED_MIME_TYPES].sort());
  for (const mime of REQUIRED_MIME_TYPES) assert.equal(allowedUploadMime(mime), mime);
  assert.equal(allowedUploadMime("text/plain; charset=utf-8"), "text/plain");
  assert.equal(allowedUploadMime("IMAGE/PNG"), "image/png");
  assert.equal(allowedUploadMime("image/jpg"), null);
  assert.equal(allowedUploadMime("application/octet-stream"), null);
  assert.equal(allowedUploadMime("text/html"), null);
  assert.equal(allowedUploadMime(""), null);
});

it("keeps only the basename when storing an upload filename", () => {
  // Given / When / Then
  assert.equal(storedFilename("note.md"), "note.md");
  assert.equal(storedFilename("../../etc/passwd"), "passwd");
  assert.equal(storedFilename("..\\windows.ini"), "windows.ini");
  assert.equal(storedFilename(""), "attachment");
  assert.equal(storedFilename("\u0000"), "attachment");
});

it("uses data/uploads when no directory override is provided", () => {
  // Given / When / Then
  assert.equal(uploadDirectory(undefined), join(process.cwd(), "data", "uploads"));
});
