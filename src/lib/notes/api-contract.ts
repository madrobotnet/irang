/**
 * Rex API_NOTE_CONTRACT — consumer reference for UI client (Rex owns server impl).
 *
 * Notes
 * - GET    /api/notes?limit=&cursor=&status=&includeDeleted=1
 *          → 200 { ok: true, notes: NoteRecord[], nextCursor }
 * - POST   /api/notes → 201 { ok: true, note }
 * - GET    /api/notes/:id → 200 { ok: true, note }
 * - PATCH  /api/notes/:id → 200 { ok: true, note } | 409 deleted | 410 purged
 * - DELETE /api/notes/:id → 200 { ok: true, note } (soft delete, sets deletedAt/purgeAt)
 * - POST   /api/notes/:id/restore → 200 { ok: true, note } | 409 not_deleted | 410 purged
 *
 * Capture (JSON)
 * - POST /api/capture → 201 { ok: true, target: "inbox", inboxItem } | { ok: true, target: "note", note }
 *   body: { title, body, target: "inbox"|"note", url? }
 *   | 502 { ok: false, code: "ingest_failed", jobId? }
 *
 * Attachments (multipart after capture)
 * - POST /api/attachments → 201 { ok: true, attachment }
 *   form: file, noteId | inboxItemId
 *   | 415 unsupported_media | 413 payload_too_large
 *
 * Errors: { ok: false, code: NoteApiErrorCode, fields?, ... } — see `@/lib/api/note-contract`.
 */

export const NOTES_API = {
  list: "/api/notes",
  item: (id: string) => `/api/notes/${id}`,
  restore: (id: string) => `/api/notes/${id}/restore`,
} as const;

export const CAPTURE_API = "/api/capture";
export const ATTACHMENTS_API = "/api/attachments";
