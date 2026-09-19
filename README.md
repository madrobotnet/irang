Second Brain (`brain.madrobot.net`). App-owned auth gate. Secrets live in the environment only — copy `.env.example` to `.env`.

Auth API (Rex contract): `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` (alias `GET /api/session`). Postgres via Compose when `DATABASE_URL` is set.

Tests: `npm test`. Postgres round-trip: `npm run test:postgres` (Docker Compose `db`) or `RUN_PG_INTEGRATION=1 DATABASE_URL=… npm test` with a local Postgres.
