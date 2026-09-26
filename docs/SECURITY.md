# Deploy checklist

Hostnames stay in the edge config. This repository does not hardcode a public domain and does not ship a Traefik service. TLS termination stays Oak-owned.

- TLS: serve the app behind HTTPS. Compose in this repo publishes the app and Postgres only. Leave Traefik with Oak.
- Cookie: `sb_session` is HttpOnly, Secure, SameSite=Lax, Path=/, with a 7 day Max-Age. The database stores the SHA-256 hash of the token. The raw token is not stored.
- Env: `AUTH_PASSWORD_HASH`, `DATABASE_URL`, `SESSION_SECRET`, and `TYPESAFE_API_KEY` come from the environment. Do not commit them or write them to logs. `AUTH_PASSWORD_HASH` is an Argon2id hash of the gate password (`npm run hash-password`), not the password itself.
- Missing gate hash: login returns 503 `{ "ok": false, "code": "misconfigured" }`. There is no keyword fallback.
- Invalid `DATABASE_URL` (unencoded `#` etc.): auth routes return 503 `misconfigured` with a JSON body; server logs a redacted message (never the password).
- Postgres/schema unavailable: auth routes return 503 `storage_unavailable` (JSON). See `docs/AUTH_OPS.md` for the full matrix and Oak env checklist.
- Lockout: 5 failures from the same client inside 15 minutes locks that client for 15 minutes. The HTTP status is 429. Further failures during an active lock do not extend it. Workers serialize that decision with `pg_advisory_xact_lock` on `brain:login:` plus the client key.
- Sessions: TTL is 7 days and the cap is 5 concurrent sessions. A new login revokes the oldest sessions above the cap and keeps the new session. Workers serialize that cap with `pg_advisory_xact_lock` on `brain:sessions`.
- Uploads: a `Content-Length` above 100MB returns 413 `payload_too_large` before the multipart body is parsed. `experimental.middlewareClientMaxBodySize` is `102mb` (Next 15's name for the proxy body cap, at least 101mb).
- URL capture: outbound fetches use a 10 second timeout, read at most 256KB (262144 bytes), and allow only `http:` and `https:` to public hosts. Private, link-local, loopback, and cloud metadata targets are rejected on the initial URL and again on the final URL after redirects. A failed fetch stores a failed ingest job and returns 502.
- Lockout client IP: `TRUSTED_PROXY_HOPS` (default `1` for Traefik; use `2` behind Cloudflare + Traefik). With one hop, `X-Real-Ip` wins over a spoofed `X-Forwarded-For`. Lock responses use HTTP 429 JSON only.
- CSP: App Router pages get per-request `script-src 'self' 'nonce-…' 'strict-dynamic'` from middleware (nonce forwarded as `x-nonce` for inline flight scripts). JSON/API responses keep `script-src 'self'` without `unsafe-inline` on scripts. Styles allow `unsafe-inline` for App Router; UI fonts load via `next/font` (self-origin `/_next/static`), not third-party `@import` (V5 removed jsDelivr Pretendard to avoid blocked external stylesheets).
