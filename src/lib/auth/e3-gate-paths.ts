/**
 * E3 Inbox routes — verified session, same default-deny gate as E2 notes.
 * Listed for tests and PR docs. Middleware does not special-case these paths:
 * anything that is not public needs `hasVerifiedSession` (pages redirect to
 * `/login`, APIs return 401).
 *
 * Rex's App Router mounts exactly these pathnames:
 * - `GET /api/inbox` — list (`nextCursor`), `?id=` one item, `?view=ingest` jobs
 * - `POST /api/inbox` — `{ action: "suggest" | "retry", id }`
 * - `POST /api/inbox/:id/promote`
 * - `POST /api/inbox/:id/discard`
 *
 * `item-id` is the placeholder segment, same style as E2 `note-id`.
 * E2 still lists the inbox API hooks it shipped with capture.
 */

export const E3_PROTECTED_PAGE_ROUTES = ["/inbox"] as const;

/** Collection pathname for list, read, suggest, and ingest retry. */
export const E3_INBOX_COLLECTION_PATH = "/api/inbox" as const;

export function e3InboxPromotePath(id: string): string {
  return `/api/inbox/${id}/promote`;
}

export function e3InboxDiscardPath(id: string): string {
  return `/api/inbox/${id}/discard`;
}

export const E3_PROTECTED_API_ROUTES = [
  E3_INBOX_COLLECTION_PATH,
  e3InboxPromotePath("item-id"),
  e3InboxDiscardPath("item-id"),
] as const;
