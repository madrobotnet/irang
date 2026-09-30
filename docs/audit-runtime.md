# Bun runtime repair audit - 2026-09-27

## Outcome

Bun 1.4.2 now runs the Next.js application with Webpack, avoiding the confirmed
Turbopack external-module failure for native `argon2`. Both development and
production startup were exercised on `127.0.0.1:3111` with
`NEXT_DIST_DIR=.next-runtime-repair` and the local QA `second_brain` database.
In both modes, login returned HTTP 200 with an `sb_session` cookie and the
cookie authenticated `GET /api/notes` with HTTP 200.

## Cause and repair

There were two independent runtime failures:

1. Next 16's default Turbopack development server generated an external
   `argon2-*` module that Bun could resolve in a fresh process but not in the
   request worker. The supported `dev` and `build` scripts now select Next's
   documented `--webpack` option while retaining Bun as runtime and script
   runner.
2. A PHC hash contains `$`, which Bun and Next treat as dotenv interpolation.
   A raw QA hash was reduced to `=19=65536,t=3,p=4`. A once-escaped value was
   intact in the launcher but reached the actual Next request worker with
   length 25, zero dollar signs, and zero backslashes after another environment
   load. The password generator now emits two dotenv escape layers, and the
   authentication config boundary removes the one remaining layer. A normal
   production `AUTH_PASSWORD_HASH` supplied directly in the process environment
   remains unchanged.

The Next scripts use `bun --no-env-file` so Next owns the initial dotenv load.
Malformed expanded values now fail at the configuration boundary with an
operational message instead of reaching `argon2.verify`.

## HTTP proof

The QA `.env.local` held the local QA database URL and the double-escaped hash
for password `devpass`. The HTTP proof did not print the hash or cookie value.

Development startup:

```sh
NEXT_DIST_DIR=.next-runtime-repair \
  bun run dev --hostname 127.0.0.1 --port 3111
```

Observed startup:

```text
$ bun --no-env-file --bun next dev --webpack --hostname "127.0.0.1" --port "3111"
▲ Next.js 16.3.6 (webpack)
✓ Ready in 214ms
```

Requests:

```sh
cookie=$(mktemp)
curl --silent --show-error --output /tmp/login.json --dump-header /tmp/login.headers \
  --write-out '%{http_code}\n' -c "$cookie" \
  -H 'content-type: application/json' --data '{"password":"devpass"}' \
  http://127.0.0.1:3111/api/auth/login
curl --silent --show-error --output /tmp/notes.json --write-out '%{http_code}\n' \
  -b "$cookie" http://127.0.0.1:3111/api/notes
rm -f "$cookie" /tmp/login.json /tmp/login.headers /tmp/notes.json
```

Observed result:

```text
login_status=200 sb_session_cookie=true notes_status=200 response_shapes_valid=true
```

Production build and startup:

```sh
NEXT_DIST_DIR=.next-runtime-repair bun run build
NEXT_DIST_DIR=.next-runtime-repair INSECURE_COOKIES=1 \
  bun run start --hostname 127.0.0.1 --port 3111
```

`INSECURE_COOKIES=1` is limited to this local plain-HTTP QA exercise. The build
compiled, type checked, generated 21 static pages, and completed successfully.
The production server reported ready in 102ms. Repeating the requests above
produced:

```text
production_login_status=200 sb_session_cookie=true production_notes_status=200
```

Both development and production process groups were terminated with `SIGTERM`.
After each teardown, `ss -ltn '( sport = :3111 )'` showed no listener. Final
teardown result:

```text
production_server_stopped=true port_3111_listening=false
```

## Regression and static checks

Scoped auth tests used the local `second_brain_test` database. This reproducible
form derives its URL from the QA config without printing the credentials:

```sh
DATABASE_URL="$(bun --no-env-file -e '
  const line = (await Bun.file(".env.local").text()).match(/^DATABASE_URL=(.*)$/m)?.[1];
  if (!line) process.exit(1);
  const url = new URL(line);
  url.pathname = "/second_brain_test";
  process.stdout.write(url.href);
')" bun test src/server/auth
```

Result: 9 passed, 0 failed. This includes regression cases for intact,
dotenv-escaped, and dotenv-damaged PHC values.

```sh
bun x eslint src/server/auth/config.ts src/server/auth/config.test.ts \
  scripts/hash-password.mjs next.config.ts
bun run typecheck
```

Both commands exited 0 with no diagnostics. The password utility was also piped
`devpass`; its generated double-escaped assignment survived Next's dotenv
loader, normalized to a 97-character `$argon2id$` PHC value, and verified true
with `argon2`.
