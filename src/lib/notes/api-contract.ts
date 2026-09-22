/**
 * Rex API_NOTE_CONTRACT (authoritative consumer copy for Lio client).
 * Server impl: Kai/Rex — do not edit `src/server/**` from UI lane.
 */

import type { NoteApiErrorCode } from "@/lib/api/note-contract";

export const NOTES_API = {
  list: "/api/notes",
  item: (id: string) => `/api/notes/${id}`,
  restore: (id: string) => `/api/notes/${id}/restore`,
} as const;

export const CAPTURE_API = "/api/capture";
export const ATTACHMENTS_API = "/api/attachments";

/** HTTP status Rex uses per endpoint success (client asserts these). */
export const API_SUCCESS_STATUS = {
  noteCreate: 201,
  noteRead: 200,
  capture: 201,
  attachment: 201,
} as const;

/** Map Rex `{ ok: false, code }` (+ HTTP) to UI handling hints. */
export function mapNoteApiFailure(
  status: number,
  code: NoteApiErrorCode | undefined,
): NoteApiErrorCode {
  if (code) return code;
  if (status === 401) return "unauthorized";
  if (status === 413) return "payload_too_large";
  if (status === 415) return "unsupported_media";
  if (status === 502) return "ingest_failed";
  if (status === 503) return "misconfigured";
  if (status === 410) return "purged";
  if (status === 404) return "not_found";
  return "validation";
}
