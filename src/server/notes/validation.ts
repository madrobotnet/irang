import { NOTE_STATUSES, type NoteStatus } from "@/domain/notes/constants";
import {
  ATTACHMENT_WHITELIST,
  MAX_ATTACHMENT_BYTES,
} from "@/domain/notes/constants";

export function requireNonEmptyString(
  value: unknown,
  field: string,
): { ok: true; value: string } | { ok: false; fields: string[] } {
  if (typeof value !== "string") {
    return { ok: false, fields: [field] };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false, fields: [field] };
  }
  return { ok: true, value: trimmed };
}

export function parseNoteStatus(value: unknown): NoteStatus | null {
  if (typeof value !== "string") {
    return null;
  }
  return NOTE_STATUSES.includes(value as NoteStatus) ? (value as NoteStatus) : null;
}

export function extensionOf(filename: string): string {
  const idx = filename.lastIndexOf(".");
  if (idx < 0) {
    return "";
  }
  return filename.slice(idx + 1).toLowerCase();
}

export function isAllowedAttachment(
  filename: string,
  mime: string,
): boolean {
  const ext = extensionOf(filename);
  const entry = ATTACHMENT_WHITELIST.find((w) => w.ext === ext);
  if (!entry) {
    return false;
  }
  const normalized = mime.split(";")[0]?.trim().toLowerCase() ?? "";
  return entry.mimes.some((m) => m === normalized);
}

export function attachmentTooLarge(sizeBytes: number): boolean {
  return sizeBytes > MAX_ATTACHMENT_BYTES;
}
