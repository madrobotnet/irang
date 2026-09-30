# Rebuild audit - 2026-09-27 to 2026-09-28

This historical audit records observed failures, repairs and verification from
the v2 rebuild. Completion reports alone are not acceptance evidence.

## Result at audit completion

The complete tree passed **162 tests across 34 files in one Bun run**, full
TypeScript checking, ESLint and the production build. The generated standalone
server ran under Bun against an isolated QA database. Public health, manifest
and font requests returned 200; the font was a valid 2,057,688-byte WOFF2 file.

Browser acceptance exercised the actual interfaces, not only service mocks:
note editing and failed-save recovery, attachments, links and aliases, URL capture, keyboard
triage, graph interaction, search history, real cited AI streaming and
cancellation, themes, login and multi-session revocation. Desktop and mobile
captures are retained locally under `.omo/evidence/production`. The final
standalone build was inspected at 1440x900 and 390x844 for all seven feature
surfaces, with separate mobile inbox-detail and graph-inspector captures.
The note editor also passed an 820x1180 tablet check without document overflow.

The sections below retain earlier failure evidence and intermediate milestones.
They are not current blockers. Production deployment, data and authentication
were not changed. Final cleanup closed the QA browser and standalone server,
removed the browser profile, fixture attachments, temporary snapshots and
production-data copy, and removed the local QA PostgreSQL container with its
anonymous volume. The existing production containers and unrelated workspaces
were preserved.

Feature commits were checked as isolated staged trees, not only against the
combined working directory. The final settings increment passed all 162 tests
across 34 files, typecheck, lint and build; the generated-output lint correction
was checked separately with full-repository ESLint. No GitHub Actions workflow
was configured at that milestone, so these are local verification results rather
than CI claims. For CI configuration outside this audit, see
`.github/workflows/ci.yml`.

## Confirmed results

- The completed backend components ran together under Bun: 57 tests passed, 0 failed.
  Command: `bun test src/server/auth src/server/http.test.ts src/server/notes
  src/server/search src/server/graph src/server/inbox src/server/chat`.
- That passing run concealed an initialization race. Warming six PostgreSQL
  connections before the existing parallel-login scenario produced six owners
  instead of one. No sleeps or retry-until-green logic were added.
- The repair added a transaction-scoped PostgreSQL advisory lock in
  `src/server/auth/session.ts` before looking up or creating the single owner.
- The strengthened auth/API boundary suite passed: 10 tests, 0 failures; scoped
  ESLint also exited 0.
- Bun utility scripts ran successfully: the URL builder encoded special
  characters and spaces, and the password script emitted a verifiable Argon2 hash.

## Initial runtime blocker (resolved)

`bun --bun next dev` started, but `POST /api/auth/login` returned HTTP 500.
The server reported:

```text
Failed to load external module argon2-f9a25551ac54f3a1:
ResolveMessage: Cannot find module 'argon2-f9a25551ac54f3a1'
```

The generated module symlink existed and resolved in a fresh Bun process.
The development-server runtime failed despite that fresh-process result.
Webpack and single-pass Next dotenv loading resolved the runtime boundary.
Bun remains the required runtime.

## Initial acceptance requirements

- Completed UI shell and all feature pages, not placeholders.
- Actual HTTP capture, promotion, persistence, links, search and graph scenarios.
- Desktop/mobile browser checks and production-build execution.
- A clean final typecheck, lint, test suite and build on the final tree.
- Cleanup of audit servers and their locally created test records.

Research evidence and adoption decisions are recorded in
[research/ADOPTION.md](research/ADOPTION.md).

## Initial repair requirements

1. Runtime/login repair: investigate the confirmed HTTP 500 across
   Bun, Next's workers, dotenv expansion and external-package resolution.
   Check package/runtime configuration and the authentication configuration boundary
   independently of the owner/session repair.
2. URL transport repair: the earlier implementation validated one
   DNS answer, then called a hostname-based fetch that resolved again. Bind the
   outbound connection to a validated address, preserving TLS identity and
   validating each redirect.
3. Repair verification, after both repairs: execute the focused Bun
   suites, scoped lint and a fresh real HTTP login using the corrected startup
   path. Record actual results.

## Clean-install database verification

The original development Compose configuration created only `second_brain`,
while tests required `second_brain_test`. A fresh container reported zero matching
test databases. The repair added `docker/postgres/dev/01-test-database.sql` and mounted it
only in the development Compose service.

The corrected Compose configuration was started in a separate project
(`sb-bootstrap-audit`) with a fresh container and no published ports.
PostgreSQL reported both `second_brain` and `second_brain_test`. Against that new
test database, `bun test src/server/db/migrate.test.ts
src/server/notes/service.test.ts` passed all 10 tests in one run.

Cleanup: removed `sb-bootstrap-audit-20260927` with its anonymous volume and
removed the `sb-bootstrap-audit_default` network. No matching container remained.
The running development and production databases were not replaced.

LSP limitation: the installed language-server binary was executable, but the host
LSP tool couldn't resolve it. The direct verifier also couldn't find its
bundled engine source. This was not a clean diagnostic result; final TypeScript
and ESLint checks were still required, with no errors suppressed.

## HTTP acceptance of both repairs

On the repaired Bun development entry point at port 3110, HTTP checks confirmed
login 200 with a session cookie, foreign-origin mutation rejection 403, note
creation 201, persisted note read-back 200, and the source note in the target's
backlinks. Text capture returned 201; promotion returned 200; repeating
promotion returned the same note ID. Search returned that note first. Local
graph data included both real note links and the optional tag layer. Invalid
depth returned 400. Full headers and bodies, without session values, are in
`docs/audit-http-acceptance.json`.

Rerunning the focused repair suite produced 25 passing tests and 0 failures;
scoped lint passed. The Node-to-Web stream adapter initially relied on a double type
assertion; the repair replaced it with a typed pull/cancel bridge. The resulting
typecheck, seven socket/TLS/abort URL tests, and scoped lint passed. A real
`fetchUrlText("https://example.com")` returned `ok: true` and Example Domain
content. This verified real transport, not just a mocked fetch call.

Cleanup: logout succeeded; only the one QA inbox row, three QA notes
and the QA session hash were deleted. A count query returned zero remaining QA notes.
Ports 3110, 3111 and 3112 had no listeners. Browser UI acceptance was still open
at that milestone.

## Whitespace-normalized note references

Three added regression cases failed on the previous implementation: an exact
wikilink to a title containing repeated spaces, a pending link resolved after
target creation, and title lookup returning a duplicate instead of the existing
note. JavaScript normalized internal whitespace, while SQL compared only trimmed
titles. The repair made SQL comparisons use the same collapsed-space key without rewriting
the display title or note body.

The complete notes/attachments suite passed 15 tests. Repeating the
three scenarios through authenticated HTTP on port 3113 confirmed that links resolved,
get-or-create returned the original ID, and creating the target cleared the
pending link. Evidence: `docs/audit-whitespace-http.json`.

Cleanup: logged out and removed exactly four QA notes and their session from
`sb_test_notes`; the remaining QA note count was zero. Port 3113 was closed and
`.next-note-regression` was removed.

One static check exposed an unrelated stale generated validator under
`.next-audit-lead` that still imported the intentionally removed root page.
Only its obsolete `tsconfig` include entries were removed. Unrelated files and
the active server were preserved, and canonical Next route types were regenerated.

## Public login font repair

The login page requested `/fonts/PretendardVariable.woff2` without a session.
The gate returned 307 to `/login`, preventing the intended typeface from loading.
The repair allowed the public font directory without changing authentication
requirements for notes or APIs. Three focused proxy tests and scoped lint passed.

Real HTTP returned 200, `font/woff2`, and a valid `wOF2` signature. Browser
checks opened the login page with omowright and inspected these captures:

- `.omo/evidence/font-gate/login-desktop.png`: 1440×900.
- `.omo/evidence/font-gate/login-mobile.png`: 390×844, touch/mobile emulation.

Pretendard Variable reported `loaded` in both. The mobile document width was
390px with no horizontal overflow. The login form was legible and did not
overlap. Full-app visual acceptance was still pending at that milestone; the
remaining footer/countdown/touch-target corrections were subsequently completed.

Both successful QA browser sessions were closed, all `sb-font-qa.*` profiles
were removed, and port 3110 was verified closed after stopping the server.

## Storage/retrieval integration regressions

A note saved by the notes service had a SHA-256 fingerprint, while search checked
PostgreSQL MD5. A deterministic regression proved that merely searching rebuilt a
fresh embedding. The repair aligned the notes writer's cache fingerprint with search.
This fingerprint is cache metadata, not authentication or encryption.

A second regression assigned three updates distinct microseconds within the same
millisecond. Pagination returned only the first note because its cursor rounded
the database timestamp through JavaScript Date. The repair preserved PostgreSQL
microseconds in cursor UTC strings while keeping the existing wire shape for display timestamps.

Before: 21 passed, 2 failed. After: notes, attachments and search passed all 26
tests. Scoped lint passed. The final combined check also passed typecheck.

## Chat compatibility and completion

All changed chat source and tests were inspected, and the actual integration
suite was rerun. Legacy `{noteId,title,snippet?}` citations were mapped into the
new response shape without rewriting stored JSON. Provider streams were changed
to require `response.completed`; failed, incomplete and delta-only EOF responses
could no longer persist partial answers. Concurrent refreshes shared one
operation per auth file, with atomic replacement that retained unrelated fields.

The backend and frontend SSE parser checks passed 29 tests. The frontend parser
had a TypeScript expectation containing `Citation | undefined`; the expected
array was fixed without suppressing the error. A test pinned to prompt prose
was replaced with assertions of the actual model/store/stream request fields.
These tests used local fixture streams, with no live upstream calls.

## Logout failure feedback

In a QA browser, intercepting logout with HTTP 503 reproduced navigation to
`/login` with no error feedback. The repair made the shared shell report a
persistent alert and leave the current page intact on logout failure.

Browser checks confirmed the alert and unchanged `/` URL, then inspected
`.omo/evidence/logout/failure-desktop.png` (1440x900) and
`failure-mobile.png` (390x844). The mobile document width remained 390px and the
alert stayed above bottom navigation. With interception removed, logout led to
`/login` and `/api/auth/me` returned 401.

## Bun standalone container acceptance

The Bun image built successfully with exit 0. It preserved the existing
deployment's `nextjs` UID 1001 rather than switching mounted files to UID 1000.
A local 0600 fake auth fixture demonstrated the difference: UID 1000 returned
EACCES, while UID 1001 read it successfully. No real auth file was used.

The resulting image ran in production mode against a fresh isolated database.
Actual HTTP results:

- Login: 200.
- Note creation, title-target creation, persisted backlinks: successful.
- Search: 200 with keyword, fuzzy and textual-vector signals.
- Graph: 200 with two notes and their real link.
- Attachment upload: 201; download: 200 with identical bytes.
- Chat status: 200/available using the readable fake auth fixture only.
- Logout: 200.

Cleanup removed the QA container, image tag, database, fake auth fixture and
browser profiles. The stopped development server's exact home-audit session was
deleted (one row). Ports 3110, 3117 and 3156 were closed.
Canonical Next route types were regenerated and typecheck passed.

## Backend milestone before interface integration

The milestone used a single run:

```sh
TEST_DATABASE_URL=postgres://second_brain:second_brain@127.0.0.1:55432/second_brain_test \
  bun test src/server src/components/shell src/features/auth \
  src/features/chat/sse.test.ts src/proxy.test.ts
```

Result: **113 passed, 0 failed across 22 files**. Typecheck and scoped ESLint
also exited 0. This is a backend/shared-shell milestone, not final product QA.

Source inspection and browser acceptance followed the backend milestone.
Those checks found the interface and integration defects below.

## Interface and integration repairs

- Notes discarded canonical save acknowledgements and could continue destructive
  actions after a failed flush. The repair made drafts retain newer edits,
  adopt canonical metadata, survive SPA navigation and stop destructive actions
  on failure.
  Forced HTTP 503, route departure/return, retry, and dirty unload protection passed.
- A delayed attachment followed by editing and switching to preview overwrote
  the newer body. After the repair, the same held-request scenario inserted into
  the current draft and persisted it. Upload/download bytes matched. Captured
  source URLs remained visible after promotion.
- Incomplete UTF-8 in a preview link threw `URIError`. After the repair, URL
  query parsing handled it without crashing. Title autocomplete included preserved aliases.
  Trash, restore, confirmed purge and filter retention passed.
- Inbox Escape intercepted a modal's native cancellation. The repaired listener
  respected dialogs and native controls. Capture HTTP 503 retained the draft across
  closing/reopening; retry succeeded. Promotion was idempotent. Real
  `https://example.com` capture completed asynchronous text ingestion. Mobile
  triage was changed to open a dedicated detail view instead of burying it below the list.
- Graph tooltip HTML was interpreted as markup. Escaping made it literal.
  Pin state was aligned with the current simulation data. Global/local depth, tags,
  fit/reset and accessible selection passed. The mobile inspector was below
  the viewport; the repair scrolled it into view above navigation.
- Search URL and input state drifted on history navigation. The repair made the
  URL own committed results. Keyword, tag, no-result, error, shortcut and back/forward
  flows passed. A hash collision returned an unrelated Korean note for `PARA`;
  literal n-gram verification removed that result without claiming semantic AI.
- Follow-up chat depended on noisy retrieval hits. The repair made it reload
  previously cited active notes when a follow-up had no fresh matches,
  excluding deleted or archived evidence. Malformed gateway JSON and an
  already-aborted stream no longer threw or retained a reader lock.
- A live chat response produced eight real source cards and persisted
  both messages. A second request visibly streamed partial text; stopping it
  retained the question and left the database at two messages. Thread rename,
  create/delete, history reload and opening a citation passed. Token refresh
  was disabled during this browser check.
- Chat and settings cached different shapes under the same status key, crashing
  SPA navigation. The repair made both use the plain response. Theme persisted after reload.
  Revoking all sessions made both the browser and a separately created QA
  session return 401. Wrong-password feedback and successful login passed.
- Daily actions and home were aligned with the viewer's calendar and time zone.
  A Seoul date that differed from UTC selected the correct daily note; invalid zones returned 400.
  Home tests also passed with a Korean server timezone.
- The mobile shell added 60px of document overflow to fixed-height workspaces.
  The sizing repair accounted for safe-area insets, reducing the document height from
  904px to the viewport's 844px and keeping chat headers and the composer visible.

## Verification limits

The host LSP resolver remained unavailable; passing `tsc`, ESLint, build and
browser evidence are the recorded checks. Jev was intentionally unconfigured
in QA, so optional failure behavior was verified but no live Jev classification
claim is made. Native mobile installation, offline operation and performance
scores are not claimed. No test used sleeps or retry-until-green logic.
