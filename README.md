Second Brain (`brain.madrobot.net`). App-owned auth gate. Secrets live in the environment only — copy `.env.example` to `.env`.

Auth API (Rex contract): `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` (alias `GET /api/session`). Postgres via Compose when `DATABASE_URL` is set.

Tests: `npm test`. Postgres round-trip (auth + notes E2): `npm run test:postgres` (Docker Compose `db`) or `RUN_PG_INTEGRATION=1 DATABASE_URL=… npm test` with a local Postgres.

E2 API (session required): `/api/notes`, `/api/capture`, `/api/capture/share`, `/api/attachments`, `/api/inbox` (list/promote/discard hooks).

Capture/share also require `TYPESAFE_API_KEY` (Jev tag **suggestions** + `duplicateHint` proposals only — never auto-applied). Missing key → `503 typesafe_misconfigured`; TypeSafe failure → `502 judgment_failed`.
