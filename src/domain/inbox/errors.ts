/** E3 codes beyond the E2 note envelope. Same `{ ok: false, code }` shape. */

export type InboxErrorCode =
  | "already_promoted"
  | "discarded"
  | "not_failed"
  | "not_retriable";

export function inboxErrorBody(
  code: InboxErrorCode,
  extra?: Record<string, unknown>,
): { ok: false; code: InboxErrorCode } & Record<string, unknown> {
  return { ok: false, code, ...extra };
}
