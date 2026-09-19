/** Rex API_NOTE_CONTRACT envelopes (extends auth error shape). */

export type NoteApiErrorCode =
  | "validation"
  | "not_found"
  | "deleted"
  | "not_deleted"
  | "purged"
  | "unsupported_media"
  | "payload_too_large"
  | "ingest_failed"
  | "misconfigured"
  | "typesafe_misconfigured"
  | "judgment_failed"
  | "unauthorized";

export function noteErrorBody(
  code: NoteApiErrorCode,
  extra?: Record<string, unknown>,
): { ok: false; code: NoteApiErrorCode } & Record<string, unknown> {
  return { ok: false, code, ...extra };
}
