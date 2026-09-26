# Auth ops (Quinn / Oak)

## API contract (no opaque 500s)

| Route | Unauthenticated | Bad password | Missing `AUTH_PASSWORD_HASH` | Invalid `DATABASE_URL` | DB/schema down |
| --- | --- | --- | --- | --- | --- |
| `GET /api/auth/me`, `GET /api/session` | **401** `unauthorized` | — | **401** `unauthorized` | **503** `misconfigured` | **503** `storage_unavailable` |
| `POST /api/auth/login` | — | **401** `bad_password` | **503** `misconfigured` | **503** `misconfigured` | **503** `storage_unavailable` |
| `GET /api/health` | **200** `{ ok: true }` | — | **200** | **200** | **200** |

Responses are always JSON (except HTML form login redirects). Server logs are redacted (no passwords, no full `DATABASE_URL`).

## NEED_FROM_OAK (environment)

| Item | When | Action |
| --- | --- | --- |
| `DATABASE_URL` | Compose / VPS deploy | Set explicitly in `.env`; percent-encode password specials (`#`, `@`, …). Build: `npm run database-url` with `POSTGRES_APP_PASSWORD` set. **Do not** interpolate raw password into Compose. |
| `AUTH_PASSWORD_HASH` | Every deploy | Argon2id hash via `npm run hash-password`. |
| `SESSION_SECRET` | Compose | Required by Compose contract; opaque cookie path is canonical today. |
| Postgres reachable | Runtime | App role `second_brain` on DB `second_brain`; `pgcrypto`/`vector` extensions via init (Oak DB). |
| Schema migrate | First auth touch | App runs `ensureAuthSchema` once per process (`CREATE IF NOT EXISTS` only — **no** `DROP TABLE sessions` on boot). DB must allow DDL for auth tables (or pre-provision). |

**Live redeploy:** hold until Quinn PASS + user GO. Code is contract-correct without Oak changes; Oak only supplies env/DB.

## Prove (Ada → Quinn)

```bash
npm test
npm run build
```

Integration (optional): `npm run test:postgres` with Docker.
