import { MAX_ATTACHMENT_BYTES } from "./constants";

/** True when size is strictly over the Rex 100MB attachment cap (inclusive max = OK). */
export function exceedsAttachmentByteLimit(sizeBytes: number): boolean {
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0) {
    return true;
  }
  return sizeBytes > MAX_ATTACHMENT_BYTES;
}

/**
 * Whole-request Content-Length above the 100MB cap.
 * Digit length is compared as text so values past Number.MAX_SAFE_INTEGER still reject.
 * Missing or non-numeric headers do not reject here; the parsed file size is checked later.
 */
export function contentLengthExceedsLimit(
  header: string | null,
  limitBytes: number = MAX_ATTACHMENT_BYTES,
): boolean {
  if (header === null) {
    return false;
  }
  const digits = header.trim().replace(/^0+/u, "");
  if (!/^\d+$/u.test(digits)) {
    return false;
  }
  const limit = String(limitBytes);
  if (digits.length !== limit.length) {
    return digits.length > limit.length;
  }
  return digits > limit;
}
