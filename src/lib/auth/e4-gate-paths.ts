/**
 * E4 Search routes — verified session, same default-deny gate as inbox/notes.
 * Listed for tests and PR docs. Middleware does not special-case these paths:
 * anything that is not public needs `hasVerifiedSession` (pages redirect to
 * `/login`, APIs return 401). The gate keys off the pathname, so both methods
 * on a listed API are denied without a verified session.
 *
 * Rex's App Router mounts exactly these pathnames:
 * - `GET /search` — search page (Lio shell; still session-gated)
 * - `GET` and `POST /api/search` — search-result envelope
 * - `GET` and `POST /api/search/evidence` — evidence-note envelope
 *
 * This list does not add a public search path, a keyword-fallback route,
 * or a second model pass that re-verifies Jev.
 */

export const E4_PROTECTED_PAGE_ROUTES = ["/search"] as const;

/** Collection pathname for the search-result envelope (`GET` and `POST`). */
export const E4_SEARCH_COLLECTION_PATH = "/api/search" as const;

/** Evidence-note pathname (`GET` and `POST`). */
export const E4_EVIDENCE_PATH = "/api/search/evidence" as const;

export const E4_PROTECTED_API_ROUTES = [
  E4_SEARCH_COLLECTION_PATH,
  E4_EVIDENCE_PATH,
] as const;

export const E4_GATED_PATHS = [
  ...E4_PROTECTED_PAGE_ROUTES,
  ...E4_PROTECTED_API_ROUTES,
] as const;
