/**
 * E2 note/capture/inbox/attachment routes Rex exposed — all require verified session
 * (middleware default-deny for non-public paths; listed here for tests & PR docs).
 * The Inbox page and inbox APIs are also listed in `e3-gate-paths.ts`.
 */

export const E2_PROTECTED_PAGE_ROUTES = ["/notes"] as const;

export const E2_PROTECTED_API_ROUTES = [
  "/api/notes",
  "/api/notes/note-id",
  "/api/notes/note-id/restore",
  "/api/capture",
  "/api/capture/share",
  "/api/inbox",
  "/api/inbox/item-id/promote",
  "/api/inbox/item-id/discard",
  "/api/attachments",
  "/api/attachments/attachment-id",
] as const;
