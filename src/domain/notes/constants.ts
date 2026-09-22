export const NOTE_STATUSES = ["draft", "confirmed", "archived"] as const;
export type NoteStatus = (typeof NOTE_STATUSES)[number];

export const INBOX_SOURCES = ["web", "url", "share", "api"] as const;
export type InboxSource = (typeof INBOX_SOURCES)[number];

export const SOFT_DELETE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export const MAX_ATTACHMENT_BYTES = 100 * 1024 * 1024;

export const DEFAULT_LIST_LIMIT = 50;
export const MAX_LIST_LIMIT = 100;

export const ATTACHMENT_WHITELIST: ReadonlyArray<{
  ext: string;
  mimes: readonly string[];
}> = [
  { ext: "md", mimes: ["text/markdown", "text/plain"] },
  { ext: "pdf", mimes: ["application/pdf"] },
  { ext: "png", mimes: ["image/png"] },
  { ext: "jpg", mimes: ["image/jpeg"] },
  { ext: "jpeg", mimes: ["image/jpeg"] },
  { ext: "zip", mimes: ["application/zip"] },
  { ext: "mp3", mimes: ["audio/mpeg"] },
  { ext: "mp4", mimes: ["video/mp4"] },
];
