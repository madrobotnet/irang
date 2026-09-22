export const CAPTURE_MAX_BYTES = 100 * 1024 * 1024;

const EXT_WHITELIST = new Set([
  "md",
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "zip",
  "mp3",
  "mp4",
]);

export type FileValidationResult =
  | { ok: true }
  | { ok: false; reason: "mime" | "size" };

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot < 0) return "";
  return name.slice(dot + 1).toLowerCase();
}

export function validateCaptureFile(file: File | null | undefined): FileValidationResult {
  if (!file) return { ok: true };
  if (file.size > CAPTURE_MAX_BYTES) {
    return { ok: false, reason: "size" };
  }
  const ext = extensionOf(file.name);
  if (!EXT_WHITELIST.has(ext)) {
    return { ok: false, reason: "mime" };
  }
  return { ok: true };
}
