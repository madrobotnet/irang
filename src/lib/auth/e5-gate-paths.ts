/**
 * E5 Chat routes — verified session, same default-deny gate as notes/inbox/search.
 * Listed for tests and PR docs. Middleware does not special-case these paths:
 * anything that is not public needs `hasVerifiedSession` (pages redirect to
 * `/login`, APIs return 401). A present cookie is not enough; the lookup is
 * the same session check as notes, inbox, and search. The gate keys off the
 * pathname, so every method on a listed API is denied without a verified session.
 *
 * Seats Rex mounts later (no handlers in this module):
 * - `GET /chat` — chat page (Lio shell; still session-gated)
 * - `/api/chat` — thread collection
 * - `/api/chat/:threadId` — one thread
 * - `/api/chat/:threadId/messages` — messages
 * - `/api/chat/:threadId/propose-edit` — note-edit proposal only
 *
 * `thread-id` is the placeholder segment, same style as E2 `note-id`.
 * This list does not add a public chat path, a keyword-fallback route,
 * an apply/write route, or a second model pass that re-verifies Jev.
 */

export const E5_PROTECTED_PAGE_ROUTES = ["/chat"] as const;

/** Collection pathname for chat threads. */
export const E5_CHAT_COLLECTION_PATH = "/api/chat" as const;

export function e5ChatThreadPath(id: string): string {
  return `/api/chat/${id}`;
}

export function e5ChatMessagesPath(threadId: string): string {
  return `/api/chat/${threadId}/messages`;
}

/** Proposal seat. There is no apply/write pathname on this gate. */
export function e5ChatProposeEditPath(threadId: string): string {
  return `/api/chat/${threadId}/propose-edit`;
}

export const E5_PROTECTED_API_ROUTES = [
  E5_CHAT_COLLECTION_PATH,
  e5ChatThreadPath("thread-id"),
  e5ChatMessagesPath("thread-id"),
  e5ChatProposeEditPath("thread-id"),
] as const;

export const E5_GATED_PATHS = [
  ...E5_PROTECTED_PAGE_ROUTES,
  ...E5_PROTECTED_API_ROUTES,
] as const;
