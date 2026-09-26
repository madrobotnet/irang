Second Brain (`brain.madrobot.net`). App-owned auth gate. Secrets live in the environment only — copy `.env.example` to `.env`.

Auth API (Rex contract): `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` (alias `GET /api/session`). Postgres via Compose when `DATABASE_URL` is set (percent-encode password specials — `npm run database-url`).

Tests: `npm test`. Postgres round-trip (auth + notes E2): `npm run test:postgres` (Docker Compose `db`) or `RUN_PG_INTEGRATION=1 DATABASE_URL=… npm test` with a local Postgres.

E2 API (session required): `/api/notes`, `/api/capture`, `/api/capture/share`, `/api/attachments`, `/api/inbox` (list/promote/discard hooks).

Capture/share also require `TYPESAFE_API_KEY` (Jev tag **suggestions** + `duplicateHint` proposals only — never auto-applied). Missing key → `503 typesafe_misconfigured`; TypeSafe failure → `502 judgment_failed`. Typed client seat for Rex follow-up: `src/lib/jev/`.

PWA icons `public/icons/icon-192.png` and `public/icons/icon-512.png` are C3 Eclipse. `public/icons/icon-48.png` is the favicon and the apple touch icon. The source drawing is `src/lib/pwa/c3-eclipse.svg`. `src/app/manifest.ts` serves the manifest, including `share_target.action` `/api/capture/share`. There is no service worker.
