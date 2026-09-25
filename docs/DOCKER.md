# Docker Compose (Postgres + app)

Compose in this repository runs **Postgres (pgvector)** and the **Next.js app** only. Traefik and TLS stay Oak-owned.

## Postgres image and roles

- Image: `pgvector/pgvector:0.8.6-pg18` (pinned Postgres **18** / pgvector 0.8.6; do not use `pg16` or floating `pg18` tags).
- **COMPOSE_PG_IMAGE_TAG:** `pgvector/pgvector:0.8.6-pg18`
- **Pin verification (2026-09-25):** Docker Hub lists `0.8.6-pg18` (no `0.8.7-pg18` / `0.8.8-pg18` tags). [pgvector/pgvector tags](https://hub.docker.com/r/pgvector/pgvector/tags?name=0.8.6-pg18). Supported tags documented in [pgvector v0.8.6 README](https://github.com/pgvector/pgvector/blob/v0.8.6/README.md). Postgres **18.6** is the current supported 18.x minor per [PostgreSQL versioning](https://www.postgresql.org/support/versioning/).
- Data volume: `second_brain_pg18` mounted at **`/var/lib/postgresql`** (not `/var/lib/postgresql/data`). Official Postgres 18 images use `PGDATA` under `/var/lib/postgresql/18/docker` inside that mount.
- The container superuser is `postgres` (password from `POSTGRES_PASSWORD` in `.env`). It exists only for init.
- The application connects as the non-superuser **`second_brain`** to database **`second_brain`**, created on first boot by `docker/postgres/init/01-app-role.sh`.
- `vector` is installed in the app database during init.

Oak VPS may still run an older `pg16` stack until cutover; this Compose file is the repo source of truth for **pg18** only.

## Required environment

Copy `.env.example` to `.env` and set at least:

- `POSTGRES_PASSWORD` — superuser password (init only; do not use in `DATABASE_URL`).
- `POSTGRES_APP_PASSWORD` — password for the `second_brain` role.
- `DATABASE_URL` — `postgres://second_brain:<POSTGRES_APP_PASSWORD>@db:5432/second_brain` (Compose) or `127.0.0.1` when port-forwarding.
- `AUTH_PASSWORD_HASH`, `SESSION_SECRET` — see `.env.example`.

No database passwords are committed in `docker-compose.yml`.

## Commands

```bash
docker compose up -d db
npm run test:postgres   # integration tests
docker compose up --build
```

## Trusted proxy hops (lockout client IP)

Behind Traefik only: `TRUSTED_PROXY_HOPS=1` (default). The app prefers `X-Real-Ip` for a single hop so a spoofed `X-Forwarded-For` cannot shift lockout to another client.

Behind Cloudflare and Traefik: set `TRUSTED_PROXY_HOPS=2` and ensure the edge forwards a full `X-Forwarded-For` chain.
