import { DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT, NOTE_STATUSES, type NoteStatus } from "@/domain/notes/constants";
import { ATTACHMENT_WHITELIST } from "@/domain/notes/constants";
import { exceedsAttachmentByteLimit } from "@/domain/notes/attachment-limits";

export function parseListLimit(raw: string | null): number {
  if (!raw) {
    return DEFAULT_LIST_LIMIT;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) {
    return DEFAULT_LIST_LIMIT;
  }
  return Math.min(n, MAX_LIST_LIMIT);
}

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
  return exceedsAttachmentByteLimit(sizeBytes);
}
