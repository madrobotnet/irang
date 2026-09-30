# Runtime and URL repair verification - 2026-09-27

## Producer evidence

Read `docs/audit-runtime.md`, `docs/audit-url.md`, `docs/ARCHITECTURE.md`, and `docs/REBUILD-AUDIT.md`. The producer reports exist. The runtime report documents Bun 1.4.2, Webpack startup, dotenv-safe Argon2 configuration, and previous HTTP 200 login/notes results on port 3111. The URL report documents pinned-address transport, redirect validation, and URL regression coverage. `docs/audit-http-failures.json` also exists and records earlier failed HTTP attempts; those failures were not treated as acceptance evidence.

## Focused test run

Exact command:

```sh
TEST_DATABASE_URL=postgres://second_brain:second_brain@127.0.0.1:55432/second_brain_test bun test src/server/auth src/server/http.test.ts src/server/inbox
```

Exit code: **0** (Bun 1.4.2). Output summary:

```text
25 pass
0 fail
55 expect() calls
Ran 25 tests across 6 files. [1015.00ms]
```

The run included authentication config, lockout/session, HTTP boundary, inbox service, and URL transport tests.

## Local HTTP acceptance

Used the corrected development script with the local QA database from `.env.local`; no production database or production application was accessed.

Exact startup command:

```sh
NEXT_DIST_DIR=.next-repair-check bun run dev --hostname 127.0.0.1 --port 3112
```

Startup log:

```text
$ bun --no-env-file --bun next dev --webpack --hostname "127.0.0.1" --port "3112"
▲ Next.js 16.3.6 (webpack)
✓ Ready in 201ms
```

A readiness probe to `GET /api/health` returned HTTP 200. Exact acceptance requests:

```sh
cookie=$(mktemp)
curl --silent --show-error --output /tmp/sb-repair-check-login.json --dump-header /tmp/sb-repair-check-login.headers --write-out 'HTTP_STATUS=%{http_code}\n' -c "$cookie" \
  -H 'content-type: application/json' --data '{"password":"devpass"}' \
  http://127.0.0.1:3112/api/auth/login
curl --silent --show-error --output /tmp/sb-repair-check-notes.json --write-out 'HTTP_STATUS=%{http_code}\n' -b "$cookie" \
  http://127.0.0.1:3112/api/notes
rm -f "$cookie"
```

Observed results:

```text
login: HTTP_STATUS=200
body: {"ok":true}
notes: HTTP_STATUS=200
body: {"notes":[],"nextCursor":null}
```

The cookie jar was passed from login to notes; response bodies were as shown. The inspected cookie-name listing was empty because curl's default cookie-jar output omits HttpOnly cookies from ordinary listings, so no cookie value is reported. The authenticated notes request succeeded.

The server log also reported that Next updated `tsconfig.json` to add `.next-repair-check/types/**/*.ts` and `.next-repair-check/dev/types/**/*.ts` to `include` during startup. No source or package configuration was changed by this task. The generated dist directory is ignored build output.

## Teardown

Sent `SIGTERM` to the owned background startup process (PID 3472666), then waited for it. Observed:

```text
SERVER_WAIT_EXIT=0
ss -ltn '( sport = :3112 )'
# no listener rows
LISTENER_CHECK_EXIT=0
```

Temporary cookie jar removed. The server is stopped and port 3112 is no longer listening.

## Result

**PASS** - required focused Bun tests passed with zero failures; login and cookie-authenticated notes GET both returned HTTP 200; owned server teardown was confirmed.
