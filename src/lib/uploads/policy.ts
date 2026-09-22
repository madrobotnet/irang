import { join } from "node:path";

export const MAX_UPLOAD_BYTES = 104857600;

export const ALLOWED_UPLOAD_MIME_TYPES = [
  "text/markdown",
  "text/plain",
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/zip",
  "audio/mpeg",
  "video/mp4",
] as const;

export type AllowedUploadMime = (typeof ALLOWED_UPLOAD_MIME_TYPES)[number];

export function exceedsUploadLimit(byteLength: number): boolean {
  return byteLength > MAX_UPLOAD_BYTES;
}

export function contentLengthExceedsLimit(header: string | null): boolean {
  if (header === null) return false;
  const digits = header.trim().replace(/^0+/u, "");
  if (!/^\d+$/u.test(digits)) return false;
  const limit = String(MAX_UPLOAD_BYTES);
  if (digits.length !== limit.length) return digits.length > limit.length;
  return digits > limit;
}

export function allowedUploadMime(mime: string): AllowedUploadMime | null {
  const head = mime.split(";", 1)[0] ?? "";
  const normalized = head.trim().toLowerCase();
  for (const candidate of ALLOWED_UPLOAD_MIME_TYPES) {
    if (candidate === normalized) return candidate;
  }
  return null;
}

export type FileDecision =
  | { readonly kind: "too_large" }
  | { readonly kind: "unsupported_type" }
  | { readonly kind: "accept"; readonly mime: AllowedUploadMime };

export function decideFile(file: { readonly mime: string; readonly byteLength: number }): FileDecision {
  if (exceedsUploadLimit(file.byteLength)) return { kind: "too_large" };
  const mime = allowedUploadMime(file.mime);
  if (mime === null) return { kind: "unsupported_type" };
  return { kind: "accept", mime };
}

export function storedFilename(name: string): string {
  const segments = name.split(/[/\\]/u);
  const base = segments[segments.length - 1] ?? "";
  let cleaned = "";
  for (const char of base) {
    if (char >= " ") cleaned += char;
  }
  const trimmed = cleaned.slice(0, 255);
  return trimmed.length > 0 ? trimmed : "attachment";
}

export function uploadDirectory(override: string | undefined): string {
  if (override !== undefined && override.length > 0) return override;
  return join(process.cwd(), "data", "uploads");
}

export function uploadRoot(): string {
  return uploadDirectory(process.env["BRAIN_UPLOAD_DIR"]);
}
