/**
 * E6 Home routes — verified session, same default-deny gate as notes,
 * inbox, search, and chat. Listed for tests and PR docs. Middleware does
 * not special-case these paths: anything that is not public needs
 * `hasVerifiedSession` (pages redirect to `/login`, APIs return 401).
 * A present cookie is not enough; the lookup is the same session check
 * as the earlier gates. The gate keys off the pathname, so every method
 * on the listed API is denied without a verified session.
 *
 * Seats Rex mounts later (no handler in this module):
 * - `GET /` — home page (existing shell; still session-gated)
 * - `/api/home` — home summary envelope
 *
 * Public PWA files stay ungated, matching `/favicon.ico` and `/_next/`.
 * Browsers fetch the manifest and home-screen icons without a session
 * cookie when checking add-to-home-screen. Those files are static brand
 * assets, not vault data. This list has no service worker and no
 * offline-read route.
 */

export const E6_PROTECTED_PAGE_ROUTES = ["/"] as const;

/** Summary pathname for the home envelope. */
export const E6_HOME_SUMMARY_PATH = "/api/home" as const;

export const E6_PROTECTED_API_ROUTES = [E6_HOME_SUMMARY_PATH] as const;

export const E6_GATED_PATHS = [
  ...E6_PROTECTED_PAGE_ROUTES,
  ...E6_PROTECTED_API_ROUTES,
] as const;

/**
 * Served without a session. `/manifest.webmanifest` is the Next metadata
 * route. Icon files live under `public/icons/` and are requested by that
 * manifest. Keep this list aligned with `WEB_APP_MANIFEST`.
 */
export const E6_PUBLIC_PWA_PATHS = [
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
] as const;
