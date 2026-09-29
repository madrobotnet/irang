import path from "node:path";
import { ApiError } from "@/server/http";

// v1 appended a native basename; on Linux a literal backslash is part of it.
// Reject actual path components and NUL without renaming those existing files.
const STORAGE_KEY_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?:-[^/\0]+)?$/i;

export function attachmentsDir(): string {
  return process.env.ATTACHMENTS_DIR?.trim() || path.join(process.cwd(), ".data", "attachments");
}

export function storagePath(key: string): string {
  if (!STORAGE_KEY_RE.test(key) || path.basename(key) !== key) {
    throw new ApiError("not_found", "첨부 파일을 찾을 수 없습니다.");
  }
  return path.join(attachmentsDir(), key);
}
