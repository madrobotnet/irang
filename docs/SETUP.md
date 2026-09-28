# Second Brain 2.2.0 — Installation & Configuration

Deployment guide for a single-owner, self-hosted Second Brain instance. Everything
ships as two Docker Compose services (the Next.js app and a Postgres database) plus
two named data volumes. Host Bun is **not** required: the few one-shot scripts run
through the same `oven/bun:1.4.2-slim` image the app is built from.

Architecture overview: [ARCHITECTURE.md](ARCHITECTURE.md).

## 1. What you deploy

`compose.yml` defines:

| Service | Image | Notes |
| --- | --- | --- |
| `app` | built from `Dockerfile` (Bun standalone Next.js server) | Runs as user `nextjs` (UID/GID 1001). Publishes `127.0.0.1:${APP_PORT:-3000}:3000` — loopback only. Docker healthcheck polls `/api/health`. |
| `db` | `pgvector/pgvector:0.8.6-pg18` | Internal only (no host port). Healthcheck `pg_isready -U postgres`; the app waits for it. On a **fresh** data volume the Postgres entrypoint runs `docker/postgres/production/01-app-role.sql` — it precreates the `pgcrypto`, `vector`, and `pg_trgm` extensions and the restricted application role (section 4). |

Named volumes (Compose prefixes them with the project name — the directory name by
default, e.g. `second-brain_app-data`):

| Volume | Mounted at | Contents |
| --- | --- | --- |
| `app-data` | `/app/.data` (app container) | Attachments (`.data/attachments`) and the account-login CLI credential stores (`auth/codex`, `auth/google`), owned by UID 1001, `auth` mode 0700 |
| `postgres-data` | `/var/lib/postgresql` (db container) | All application data: notes, inbox, chat threads, attachments metadata, sessions, and the saved AI settings |

## 2. Prerequisites

- Docker Engine + Docker Compose v2 (this guide was verified with Docker 29 /
  Compose v5.5.1 on Linux arm64).
- Linux or macOS. For anything reachable beyond `127.0.0.1`, a TLS-terminating
  reverse proxy you control (section 6).
- No host Node or Bun: one-shot scripts run via `docker run` with the mounted
  repository (section 3). You only need them once, before the first
  `docker compose up`.

## 3. Step 1 — generate the operator `.env`

Run from the repository root. This creates the file Compose reads (`./.env`) with
fresh random secrets, mode `0600`, and prints the installation code once:

```sh
docker run --rm -v "$PWD":/repo -w /repo --user "$(id -u):$(id -g)" \
  oven/bun:1.4.2-slim bun run setup-env
```

Output:

```
Created /repo/.env
Installation code: <64 hex chars>
Keep this code private. Enter it on /setup after starting the server.
```

The generated file contains:

| Variable | Value | Purpose |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | 64 random hex chars, distinct | Application DB role password; Compose interpolates it into `DATABASE_URL`, and the db init script uses it to create the role |
| `POSTGRES_ADMIN_PASSWORD` | 64 random hex chars, distinct | Password of the db container's `postgres` superuser account; operator maintenance only — never given to the app |
| `SETUP_TOKEN` | 64 random hex chars, distinct | The "installation code" that guards the first-run wizard |
| `APP_PORT` | `3000` | Loopback port published by the app service |
| `INSECURE_COOKIES` | `0` | Session cookie `Secure` flag (see section 6) |
| `TRUSTED_PROXY_HOPS` | `1` | Reverse-proxy trust depth for client IPs (see section 6) |

The script refuses to overwrite an existing `.env` (it uses an exclusive-create
write). If `.env` already exists, nothing is changed.

If you maintain your own env file instead, generate only the code and paste it in:

```sh
docker run --rm -v "$PWD":/repo -w /repo --user "$(id -u):$(id -g)" \
  oven/bun:1.4.2-slim bun run setup-token
# prints: SETUP_TOKEN=<64 hex chars>
```

Compose hard-requires `POSTGRES_PASSWORD`, `POSTGRES_ADMIN_PASSWORD`, and
`SETUP_TOKEN` (it fails with "Run bun run setup-env first" otherwise), so
existing deployments that manage their own env files must still set all three.

**Windows note (untested):** the equivalent in PowerShell is

```powershell
docker run --rm -v "${PWD}:/repo" -w /repo oven/bun:1.4.2-slim bun run setup-env
```

Docker Desktop's file sharing maps bind-mount file ownership to your Windows user,
so the explicit `--user "$(id -u):$(id -g)"` uid mapping used on Linux/macOS has no
direct equivalent and is omitted. This PowerShell invocation has not been executed
on Windows; treat it as a translation, not a tested path.

## 4. Step 2 — build and start

```sh
INSECURE_COOKIES=1 docker compose up -d --build
```

This command is for loopback HTTP. For public HTTPS keep
`INSECURE_COOKIES=0` instead (section 6). To keep using local HTTP across
later recreations, set `INSECURE_COOKIES=1` in `.env`.
The db service becomes healthy first, then the app starts. Verify:

```sh
curl -i http://127.0.0.1:3000/api/health     # expect 200 {"ok":true}
```

On the **first** start with an empty `postgres-data` volume, the db entrypoint runs
`docker/postgres/production/01-app-role.sql` before accepting connections: it
precreates the `pgcrypto`, `vector`, and `pg_trgm` extensions and creates the
application role `second_brain` — login authorized with `POSTGRES_PASSWORD`,
`NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`, allowed to use and create in
the `public` schema but nothing beyond. Entrypoint init scripts run only when the
data volume is empty; they never re-run on an existing volume.

Keep the generated `POSTGRES_PASSWORD` (64 hex chars) if you edit `.env` by hand:
Compose interpolates it directly into the Postgres connection URL, so a value with
URL-special characters would break the connection string.

Credential boundary: the application connects only as the `second_brain` role, via
the `DATABASE_URL` that Compose builds from `POSTGRES_PASSWORD`. The `postgres`
superuser account and `POSTGRES_ADMIN_PASSWORD` exist for operator maintenance
inside the db container (for example an interactive `psql` session). Never put
`POSTGRES_ADMIN_PASSWORD` into `DATABASE_URL`, the app environment, or any
application configuration.

## 5. Step 3 — first-run wizard at `/setup`

Open `http://127.0.0.1:<APP_PORT>/setup`. The wizard asks for:

1. **Installation code** — the `SETUP_TOKEN` value from the operator `.env`.
   It is compared server-side (constant-time digest compare) and is never sent
   back by the server or stored in the browser. Do not put it in links or URLs.
2. **Login password** — 12–512 characters, entered twice. This becomes the
   application password used on every device.
3. **AI connections (optional)** — both chat AI and Jev default to *off*; you can
   configure or change them later in Settings (section 8).

Server behavior worth knowing:

- The wizard is public only while the installation is genuinely empty. It is
  disabled — and `/setup` redirects to `/login` — if `AUTH_PASSWORD_HASH` is set
  in the environment, or if any users, installation settings, notes, inbox items,
  chat threads, or attachments already exist.
- The first owner account and the AI settings are written in a single database
  transaction guarded by an advisory lock, and the empty-state check is repeated
  inside that transaction: two simultaneous submissions cannot both claim the
  server, and a server that gained data in the meantime is rejected with HTTP 409.
- A wrong installation code is rejected with HTTP 403 and writes nothing.
- After success you land on `/login`. Logins from one client IP lock out for the
  remainder of a 15-minute window after 5 failed attempts (HTTP 429 with a
  `retry-after`).

## 6. Cookies, HTTP vs HTTPS, and reverse-proxy trust

The session cookie (`sb_session`) and provider-login browser cookie (`sb_ai_auth`)
are `HttpOnly` and `SameSite=Lax`. Their `Secure`
flag is enabled in production builds unless `INSECURE_COOKIES=1`:

- **Local loopback HTTP test:** set `INSECURE_COOKIES=1` in the operator `.env`,
  then `docker compose up -d` to recreate the app container. Use this only for a
  loopback HTTP check — the cookie is sent over plain HTTP and the app is bound to
  `127.0.0.1`, so it is not reachable from other machines.
- **Public HTTPS:** leave `INSECURE_COOKIES=0` (the default). Put a TLS-terminating
  reverse proxy in front of the loopback-bound app on the same host. The proxy must
  forward the `Host` header unchanged: mutating API requests are checked against
  the request `Origin`, and a rewritten `Host` makes that check fail.

`TRUSTED_PROXY_HOPS` (default `1`) controls which entry of the inbound
`X-Forwarded-For` chain is treated as the real client IP: with hops = 1 the *last*
entry is used, with hops = 2 the second-to-last, and so on. If the chain is shorter
than the configured hops, the first entry is used, and only when the chain is empty
does the app fall back to `X-Real-IP`. Non-IP entries are discarded. The deployment
must restrict app ingress to the proxies it configures here.

**Cloudflare topology warning:** with Cloudflare in front of your own reverse
proxy, the chain reaching the app is typically `visitor, cloudflare-edge` (your
proxy appends the Cloudflare edge address). The default `TRUSTED_PROXY_HOPS=1`
then yields the edge address — *not* the real visitor IP — so login rate limiting
buckets all visitors together. Set `TRUSTED_PROXY_HOPS` to the number of proxies
that append to `X-Forwarded-For` between the visitor and the app (typically `2`
for Cloudflare + your proxy), and make sure your proxy appends (e.g. nginx
`proxy_add_x_forwarded_for`) rather than overwrites the header.

## 7. Environment files: what goes where

There are two different env files and two hash-escaping dialects:

| File | Created by | Used by | Dollar escaping |
| --- | --- | --- | --- |
| `.env` (repo root) | `bun run setup-env` | Docker Compose (variable interpolation + app environment) | Compose interpolates `.env` values: a literal `$` in a value must be written as `$$` |
| `.env.local` | you: `cp .env.example .env.local` | local development (`bun run dev`, loaded by Next) | Next.js env expansion: use the escaped output of `bun run hash-password` as-is |

`.env.example` is the template for the **local development** `.env.local`; it is
not the Docker deployment file. The Docker `setup-env` flow creates a different
`.env` and never overwrites it.

Password hashes for `AUTH_PASSWORD_HASH` (recovery and pre-wizard deployments —
see sections 10 and 11):

| Target | Command | Put into file |
| --- | --- | --- |
| Local dev `.env.local` | `bun run hash-password` | `AUTH_PASSWORD_HASH=...` line exactly as printed (the script escapes each `$` as `\\$`; keep the backslashes) |
| Compose `.env` | `bun scripts/hash-password.mjs` (raw hash) | Write `AUTH_PASSWORD_HASH=$$argon2id$$v=19$$...` — double every `$` yourself |

Do **not** paste the `bun run hash-password` output (the `\\$`-escaped form) into
the Compose `.env`: Compose does not understand that escaping and the hash arrives
in the container corrupted (verified with Compose v5.5.1: raw, `\$`- and
`\\$`-escaped values all arrive mangled; only `$$`-escaping resolves to the
correct PHC string).
Conversely, a raw hash in `.env.local` is expanded away by Next's env expansion.
A hash passed to `docker run --env-file` (outside Compose) is taken verbatim and
stays raw.

To change any variable in `.env`, edit the file and run `docker compose up -d` —
env changes reach the app only by recreating the container. (Settings changed in
the app UI take effect immediately without a restart; environment changes do not.)
Compose explicitly forwards the supported app variables below; it does not load
the entire operator `.env` into the app, so the database admin password stays
DB-only. Custom attachment or credential directories must remain under the
mounted `/app/.data` directory, or use an additional persistent volume.

Local development env reference (beyond what `.env.example` comments inline):
`DATABASE_URL` with a password containing special characters can be produced with
`bun run database-url` (reads `POSTGRES_APP_PASSWORD`, percent-encodes, prints the
URL — keep it out of logs). `bun run seed` adds demo notes to the dev database.

### Runtime environment reference

| Variable | Read by | Default | Meaning |
| --- | --- | --- | --- |
| `DATABASE_URL` | app (db layer) | — (required in Docker via Compose) | Postgres connection string |
| `SETUP_TOKEN` | first-run wizard | — (required by `compose.yml`) | Guards `/setup`; 32–256 chars accepted, generated value is 64 hex chars |
| `AUTH_PASSWORD_HASH` | login + setup state | empty | Argon2id PHC hash; when set it wins over any wizard-created owner password and permanently disables the wizard |
| `INSECURE_COOKIES` | login and provider Auth | `0` | `1` disables the cookie `Secure` flag (loopback HTTP only) |
| `TRUSTED_PROXY_HOPS` | client-IP resolution | `1` | Trusted `X-Forwarded-For` depth (section 6) |
| `SESSION_TTL_DAYS` | sessions | `30` | Session lifetime in days |
| `ATTACHMENTS_DIR` | attachment storage | `.data/attachments` (relative to the app's working directory) | Attachment file location; in Docker this is inside the `app-data` volume |
| `APP_PORT` | `compose.yml` | `3000` | Loopback host port |
| `POSTGRES_PASSWORD` | `compose.yml` | — (required) | Application DB role (`second_brain`) password, interpolated into `DATABASE_URL` and handed to the db init script |
| `POSTGRES_ADMIN_PASSWORD` | `compose.yml` db service | — (required) | `postgres` superuser password inside the db container; operator maintenance only, never for the app |
| `TYPESAFE_API_KEY` | Jev (legacy fallback) | empty | Jev API key used while no settings exist, or while Jev explicitly keeps the environment-managed selection |
| `TYPESAFE_JEV_MODEL` | Jev (legacy fallback) | `jev-latest` | Jev model for the env-key fallback |
| `TYPESAFE_BASE_URL` | Jev (legacy fallback) | `https://api.typesafe.ai` | Legacy SDK endpoint; the UI can retain keys only for `https://api.typesafe.ai` or `https://openrouter.ai/api` |
| `CODEX_HOME` | Codex ChatGPT auth | `~/.codex` locally; `/app/.data/auth/codex` in Docker | Directory holding Codex `auth.json` |
| `CODEX_MODEL` | chat (env fallback / default) | `gpt-5.4-mini` | Chat model when using the Codex ChatGPT login |
| `CODEX_CHATGPT_BASE_URL` | Codex ChatGPT transport | `https://chatgpt.com/backend-api/codex` | Operator-controlled Codex backend endpoint |
| `GEMINI_CLI_HOME` | Gemini CLI auth | unset locally (Google CLI login unavailable); `/app/.data/auth/google` in Docker | Directory the Gemini CLI keeps its OAuth credentials in; must be an absolute path |

## 8. AI configuration (optional, per provider)

Everything below is optional. Capture, notes, editing, search, and the graph work
fully without any AI connection. Configure via the setup wizard or later via
**Settings → AI** in the app; both write the same stored configuration.
Give each connection a name. Settings can store multiple connections and select
one for chat and another for Jev. Adding a connection does not activate it.
Switching usage off preserves the saved connections; deleting one removes its
stored credentials and disables it if it was active.

### Chat AI

| Provider | API-key mode | Account-login mode | Default model (editable) |
| --- | --- | --- | --- |
| ChatGPT / OpenAI | yes | yes — Codex CLI with ChatGPT login | `gpt-5.4-mini` |
| Claude (Anthropic) | yes | **no** — API key only | `claude-sonnet-4-6` |
| Gemini | yes | yes — Gemini CLI with Google OAuth | `gemini-2.5-flash` |
| GitHub Copilot | Copilot API token | GitHub device authorization | `gpt-5.4-mini` |
| OpenRouter | yes | browser PKCE authorization | `openai/gpt-5.4-mini` |
| xAI / Grok | yes | xAI device authorization | `grok-4.3` |
| OpenAI Compatible | custom key or explicitly keyless | no | enter the endpoint's model ID |
| Anthropic Compatible | custom key or explicitly keyless | no | enter the endpoint's model ID |

ChatGPT and Gemini account login use the official CLIs baked into the app image (pinned
`@openai/codex@0.158.0`, `@google/gemini-cli@0.61.0`). Run these from the host
shell — they execute inside the running app container:

```sh
docker compose exec app codex login --device-auth
docker compose exec -e NO_BROWSER=true app gemini
```

The CLIs keep their credential files in the persistent `app-data` volume
(`CODEX_HOME=/app/.data/auth/codex`, `GEMINI_CLI_HOME=/app/.data/auth/google`),
owned by UID 1001, so they survive upgrades and container recreation.

Important honesty rule: the app's connection status shows "ready" when the CLI
exists and a readable, non-empty official credential file is present. That file
readiness does **not** prove the account is valid, entitled, or authorized for a
model — validity and model permissions are only proven by the first real request,
and they remain under the provider's control (account state, plan, billing).

### Browser account login

For Copilot, OpenRouter or xAI, select Auth and start the connection in the form.
On first setup, enter the installation code first. Open the provider's login
page; enter the displayed device code when requested. Return to the original
Second Brain tab and save once it reports the authorization is ready.

- Copilot requires a usable Copilot entitlement. API mode expects a Copilot API
  token, not an arbitrary GitHub personal access token. An optional Enterprise
  domain and Responses, Chat Completions or Messages protocol can be selected.
- OpenRouter authorization issues a durable API key through PKCE. It does not
  transfer a ChatGPT, Claude or other subscription into OpenRouter.
- xAI account authorization uses the provider's device flow and refresh tokens.
  Account entitlement and model access are determined by xAI.
- Login attempts are scoped to the authenticated owner or installer and bound
  to the browser that started them. A ready attempt is consumed once in the same
  transaction that saves the connection; a failed save rolls consumption back.
  Attempts expire after at most 15 minutes. Expired records are removed when a
  new login starts; polling an expired attempt clears its private payload.
- Copilot and xAI tokens are refreshed server-side when approaching expiry.
  Revoked access or unsuccessful refresh requires reconnecting in settings.
  The app does not automatically enable Copilot model policies.

### Custom compatible endpoints

Choose **OpenAI Compatible** or **Anthropic Compatible**, then enter a name,
HTTP(S) base URL, model ID and API key, or explicitly choose a keyless endpoint.
Examples:

| Input | Request destination |
| --- | --- |
| `https://gateway.example` with Chat Completions | `https://gateway.example/v1/chat/completions` |
| `https://gateway.example/custom/v1` with Responses | `https://gateway.example/custom/v1/responses` |
| `https://gateway.example/v1/messages` with Messages | the same URL, not a duplicated suffix |

OpenAI Compatible supports Chat Completions or Responses. Anthropic Compatible
uses Messages. Optional extra headers support gateway-specific authentication;
header names are case-insensitive and transport headers such as `Host`, `Cookie`
and `Content-Length` cannot be overridden. A supplied authorization header
overrides the default key header. Output-token limits are optional.

URLs cannot contain embedded credentials, query strings or fragments. Put
gateway credentials in the API-key field or extra headers. Redirects are not
followed with credentials. Changing provider or normalized endpoint never
reuses the previous endpoint's key or extra headers; enter a new key or explicitly
choose keyless, and re-enter any headers needed by the new destination.

In Docker, `localhost` refers to the app container. Use a reachable Compose
service name, a LAN address, or `host.docker.internal` when the Docker host
provides it. On Linux Engine, that hostname may require an operator-added
`extra_hosts: ["host.docker.internal:host-gateway"]` mapping in the app service.
The upstream server must listen on an interface reachable from the container.

### Jev (inbox triage suggestions)

Jev is an independent, optional connection — it only powers capture classification,
tag suggestions, and duplicate candidates on inbox items; it neither requires nor
affects chat AI. Two providers are supported, reached via the TypeSafe SystemOne
endpoint:

| Provider | Endpoint | Default model | Alternative model ID |
| --- | --- | --- | --- |
| TypeSafe (official) | `https://api.typesafe.ai/v1/systemone` | `jev-latest` | `jev-1.13.0` |
| OpenRouter | `https://openrouter.ai/api/v1/systemone` | `~typesafe/jev-latest` | `typesafe/jev-1.13` |

Use a model that returns structured judgment, and the model IDs above — OpenRouter's
separate "Jev Router" product is a different thing and is not what this app calls.
TypeSafe uses an API key. OpenRouter accepts either an API key or the browser
account connection described above. Jev profiles, models and usage can be changed
without changing the active chat connection.

### Storage, consent, and change semantics

- Connection profiles, API keys, extra header values and browser Auth credentials
  are stored in Postgres (`ai_connections`). `installation_settings.ai` contains
  only the per-purpose selection IDs.
  This is private server-side storage, **not** end-to-end encrypted — protect the
  database backups accordingly (section 9).
- Keys and the setup token are never returned to the browser: the settings API
  exposes only redacted metadata such as credential-presence flags and header
  names. Saved keys and headers are retained only for the same profile, provider,
  API mode and normalized endpoint. Header values cannot be read back; omitting
  unchanged headers retains them, while an empty header object clears them.
- Each provider connection requires an explicit data-transfer consent checkbox;
  enabling either AI sends your question plus related note excerpts (chat) or
  capture content plus recent note titles (Jev) to that provider.
- Saved settings take effect immediately, without an app restart.
- Chat and Jev independently choose a saved profile, explicit off, or the legacy
  environment configuration. Off wins over ambient credentials. Adding an
  inactive profile does not change either selection or disable legacy behavior.

## 9. Data, backup, and upgrades

**Back up before every upgrade.** The two named volumes (section 1) hold
everything: `postgres-data` (database) and `app-data` (attachment files + CLI
credentials).

```sh
# Run from the repository root. The backup stays outside the checkout.
(
  set -eu
  umask 077
  mkdir -p "$HOME/second-brain-backups"
  BACKUP_DIR=$(mktemp -d "$HOME/second-brain-backups/backup.XXXXXX")
  APP_DATA_VOLUME=$(docker inspect --format \
    '{{range .Mounts}}{{if eq .Destination "/app/.data"}}{{.Name}}{{end}}{{end}}' \
    "$(docker compose ps -aq app)")
  trap 'docker compose start app' EXIT
  docker compose stop app
  docker compose exec -T db pg_dump --clean --if-exists \
    -U postgres second_brain > "$BACKUP_DIR/database.sql"
  docker run --rm -v "$APP_DATA_VOLUME:/data:ro" -v "$BACKUP_DIR:/backup" \
    alpine:3.23 sh -ec \
    'umask 077; tar czf /backup/app-data.tar.gz -C /data .; chown "$1:$2" /backup/app-data.tar.gz' \
    sh "$(id -u)" "$(id -g)"
  printf 'Backup directory: %s\n' "$BACKUP_DIR"
)
```

Both files are private (0600), and the app is stopped while the database and files
are copied together. The app is restarted even if the backup command fails.
The archive includes CLI credentials; protect it like a password.

Restore into a **separate, empty installation**, not a running server with data
you want to keep. Generate its `.env` first, set a different `APP_PORT`/Compose
project name if the original is still running, and set `BACKUP_DIR` to the printed
backup directory. The SQL contains cleanup statements and replaces matching
objects. Start only the database until restoration is complete:

```sh
docker compose build app
docker compose up -d --wait db
docker compose exec -T db psql -v ON_ERROR_STOP=1 --single-transaction \
  -U postgres second_brain < "$BACKUP_DIR/database.sql"
docker compose create app
APP_DATA_VOLUME=$(docker inspect --format \
  '{{range .Mounts}}{{if eq .Destination "/app/.data"}}{{.Name}}{{end}}{{end}}' \
  "$(docker compose ps -aq app)")
docker run --rm -v "$APP_DATA_VOLUME:/data" -v "$BACKUP_DIR:/backup:ro" \
  alpine:3.23 tar xzf /backup/app-data.tar.gz -C /data
docker compose up -d --wait
```

Restore as the database administrator, because extension metadata belongs to
`postgres`. The dump restores application-table ownership to `second_brain`;
the archive preserves UID/GID 1001. Verify a note and attachment before using the
new installation. The dump also contains sessions; use Settings to revoke them
if they should not remain valid after recovery.

**Upgrading without losing data:**

```sh
docker compose build app
docker compose up -d
```

`docker compose up -d` recreates changed containers and **keeps named volumes**.
So does `docker compose down`. **Never** run `docker compose down -v` (or
`--volumes`) on a server whose data you want to keep — that deletes both data
volumes. Schema migrations run automatically on the first database use after an
upgrade and are recorded in `schema_migrations`; if you keep production data,
verify the upgrade on a restored copy first.

## 10. Existing deployments

Deployments that predate the first-run wizard keep working unchanged:

- If `AUTH_PASSWORD_HASH` is set, the wizard is permanently disabled (`/setup`
  redirects to `/login`) and the env hash remains authoritative for login.
- If any users or protected data already exist (notes, inbox items, chat threads,
  attachments, installation settings), public account adoption is disabled the
  same way — the wizard cannot be claimed on an occupied server.
- `compose.yml` still requires `SETUP_TOKEN` and `POSTGRES_PASSWORD` even for
  env-auth deployments — and now `POSTGRES_ADMIN_PASSWORD` as well; keep all
  three in the operator `.env` (the token is then simply unused after setup is
  complete).
- Postgres entrypoint variables apply only when the data volume is first
  initialized. A deployment created with the earlier single-secret topology
  therefore keeps its original database role and privileges unchanged — the new
  restricted-role init never retrofits onto an existing volume, and no action is
  required. Never wipe the data volume just to adopt the new role layout; on a
  **fresh** volume, `POSTGRES_PASSWORD` creates the restricted application role
  and `POSTGRES_ADMIN_PASSWORD` protects the `postgres` account (section 4).
- While **no** settings have been saved in the UI, legacy environment credentials
  keep working: `TYPESAFE_API_KEY` (optionally `TYPESAFE_BASE_URL` and
  `TYPESAFE_JEV_MODEL`) drives Jev,
  and a ChatGPT-login Codex `auth.json` drives chat.
- After you save AI settings in the UI (Settings → AI), the stored configuration
  takes over for each purpose, including explicit opt-outs. The environment
  selection preserves that purpose's legacy behavior (section 8).
- Upgrading from 2.1 migrates existing inline chat/Jev credentials into named
  profiles without changing their models or activation state. Owner passwords
  and CLI credential files are not changed by this migration.

## 11. Recovery

**Lost installation code (before first-run).** The code lives in the operator
`.env`:

```sh
grep '^SETUP_TOKEN=' .env                  # on the host
docker compose exec app printenv SETUP_TOKEN   # from the running container
```

If the whole `.env` is lost, restore it from your private backup. For an
installation that has never started and has no database volume, rerun
`setup-env` to create all three secrets. Once PostgreSQL has been initialized,
changing passwords in `.env` does not change the database roles' passwords.
Recover the original values before recreating containers.

**Forgotten password.** There is no public password reset by design (single-owner
application). Recovery re-uses the existing hash tooling:

1. Run `docker compose exec app bun scripts/hash-password.mjs` to generate a new
   hash without installing Bun on the host. Its terminal prompt displays the
   entered password. Put the resulting hash into the operator `.env`, doubling
   every `$` (`$$argon2id$$v=19$$...`) on the `AUTH_PASSWORD_HASH=` line (section 7).
2. Recreate the app: `docker compose up -d`.
3. Log in with the new password. An `AUTH_PASSWORD_HASH` set in the environment
   wins over the wizard-created owner's stored password; on this login the owner
   row in the database is also rewritten to the new hash.
4. For a wizard-created owner, optionally remove `AUTH_PASSWORD_HASH` and recreate
   the app again: login falls back to the updated stored owner password.
   Pre-wizard installations must keep the environment hash.

For local development the same recovery uses `.env.local` and the escaped
`bun run hash-password` output; restart `bun run dev` afterwards. If the stored
owner password is unknown *and* you prefer to keep the env hash permanently, step 4
is simply skipped.

## 12. License

Second Brain is released under the MIT License — see [LICENSE](../LICENSE).
