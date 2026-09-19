import { MAX_ATTACHMENT_BYTES } from "./constants";

/** True when size is strictly over the Rex 100MB attachment cap (inclusive max = OK). */
export function exceedsAttachmentByteLimit(sizeBytes: number): boolean {
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0) {
    return true;
  }
  return sizeBytes > MAX_ATTACHMENT_BYTES;
}
