# Rebuild audit - 2026-09-27 to 2026-09-28

The user requested a fresh audit of the earlier implementation. Completion flags
are not acceptance evidence. This document records observed failures and repairs.

## Current result

The complete tree passed **162 tests across 34 files in one Bun run**, full
TypeScript checking, ESLint and the production build. The generated standalone
server runs under Bun against an isolated QA database. Public health, manifest
and font requests return 200; the font is a valid 2,057,688-byte WOFF2 file.

The lead exercised the actual interfaces, not only service mocks: note editing
and failed-save recovery, attachments, links and aliases, URL capture, keyboard
triage, graph interaction, search history, real cited AI streaming and
cancellation, themes, login and revoking multiple sessions. Desktop and mobile
captures are retained locally under `.omo/evidence/production`. The final
standalone build was inspected at 1440x900 and 390x844 for all seven feature
surfaces, with separate mobile inbox-detail and graph-inspector captures.
The note editor also passed an 820x1180 tablet check without document overflow.

The sections below retain the earlier red evidence and intermediate milestones.
They are not current blockers. Production deployment, data and authentication
were not changed. Final cleanup closed the owned browser and standalone server,
removed their profile, fixture attachments, temporary commit snapshots and
production-data copy, and removed the local QA PostgreSQL container with its
anonymous volume. The existing production containers and unrelated workspaces
were preserved.

Feature commits were checked as isolated staged trees, not only against the
combined working directory. The final settings increment passed all 162 tests
across 34 files, typecheck, lint and build; the generated-output lint correction
was checked separately with full-repository ESLint. No GitHub Actions workflow
is configured, so these are local verification results rather than CI claims.

## Confirmed results

- The completed backend lanes ran together under Bun: 57 tests passed, 0 failed.
  Command: `bun test src/server/auth src/server/http.test.ts src/server/notes
  src/server/search src/server/graph src/server/inbox src/server/chat`.
- That passing run concealed an initialization race. Warming six PostgreSQL
  connections before the existing parallel-login scenario produced six owners
  instead of one. No sleeps or retry-until-green logic were added.
- `src/server/auth/session.ts` now acquires a transaction-scoped PostgreSQL
  advisory lock before looking up or creating the single owner.
- The strengthened auth/API boundary suite passed: 10 tests, 0 failures; scoped
  ESLint also exited 0.
- Bun utility scripts run successfully: the URL builder encodes special
  characters and spaces, and the password script emits a verifiable Argon2 hash.

## Initial runtime blocker (resolved)

`bun --bun next dev` starts, but `POST /api/auth/login` returned HTTP 500.
The server reported:

```text
Failed to load external module argon2-f9a25551ac54f3a1:
ResolveMessage: Cannot find module 'argon2-f9a25551ac54f3a1'
```

The generated module symlink exists and resolves in a fresh Bun process.
The development-server runtime failed despite that fresh-process result.
Webpack and single-pass Next dotenv loading resolved the runtime boundary.
Bun remains the required runtime.

## Initial acceptance requirements

- Completed UI shell and all feature pages, not placeholders.
- Actual HTTP capture, promotion, persistence, links, search and graph scenarios.
- Desktop/mobile browser checks and production-build execution.
- A clean final typecheck, lint, test suite and build on the final tree.
- Cleanup of audit servers and their locally created test records.

The research synthesis worker returned an acknowledgement rather than its
artifact. `docs/research/ADOPTION.md` now exists as lead-written synthesis; the
worker completion flag itself was not accepted as evidence.

## Repair phase topology

This is a separate mass-ulw phase, not a restart of the foundation graph.

1. Runtime/login repair (`deep-low`): investigate the confirmed HTTP 500 across
   Bun, Next's workers, dotenv expansion and external-package resolution.
   Own package/runtime configuration and the authentication config boundary,
   not the already-repaired owner/session module.
2. URL transport repair (`deep-low`): the current implementation validates one
   DNS answer, then calls a hostname-based fetch that resolves again. Bind the
   outbound connection to a validated address, preserving TLS identity and
   validating each redirect. Own only inbox URL transport and its tests.
3. Repair verification (`quick`), depending on both: execute the focused Bun
   suites, scoped lint and a fresh real HTTP login using the corrected startup
   path. Report actual output, not upstream completion text.

The two producer scopes do not overlap. The lead keeps foundation integration,
the next UI phase, browser QA, evidence review and delivery. Existing shell work
must not be duplicated while its original worker is alive.

## Clean-install database verification

The original development Compose configuration created only `second_brain`,
while tests require `second_brain_test`. A fresh container reported zero matching
test databases. Added `docker/postgres/dev/01-test-database.sql` and mounted it
only in the development Compose service.

The corrected Compose configuration was started in a separate project
(`sb-bootstrap-audit`) with a fresh container and no published ports.
PostgreSQL reported both `second_brain` and `second_brain_test`. Against that new
test database, `bun test src/server/db/migrate.test.ts
src/server/notes/service.test.ts` passed all 10 tests in one run.

Cleanup: removed `sb-bootstrap-audit-20260927` with its anonymous volume and
removed the `sb-bootstrap-audit_default` network. No matching container remains.
The running development and production databases were not replaced.

LSP limitation: the installed language-server binary is executable, but the host
LSP tool cannot resolve it. The skill's direct verifier also cannot find its
bundled engine source. This is not a clean diagnostic result; final TypeScript
and ESLint checks remain required and no errors are suppressed.

## Lead acceptance of both repair lanes

On the repaired Bun development entry point at port 3110, the lead personally
observed login 200, session cookie issuance, foreign-origin mutation rejection
403, note creation 201, persisted note read-back 200, and the source note in the
target's backlinks. Text capture returned 201; promotion returned 200; repeating
promotion returned the same note ID. Search returned that note first. Local
graph data included both real note links and the optional tag layer. Invalid
depth returned 400. Full headers and bodies, without session values, are in
`docs/audit-http-acceptance.json`.

The lead reran the focused repair suite: 25 tests passed, 0 failed, and scoped
lint passed. The Node-to-Web stream adapter initially relied on a double type
assertion; the lead replaced it with a typed pull/cancel bridge. The resulting
typecheck, seven socket/TLS/abort URL tests, and scoped lint passed. A real
`fetchUrlText("https://example.com")` returned `ok: true` and Example Domain
content. This verifies real transport, not just a mocked fetch call.

Cleanup: logout succeeded; deleted only the one QA inbox row, three QA notes
and the lead's QA session hash. A count query returned zero remaining QA notes.
Ports 3110, 3111 and 3112 had no listeners. Browser UI acceptance was still open
at that milestone.

## Whitespace-normalized note references

Three added regression cases failed on the previous implementation: an exact
wikilink to a title containing repeated spaces, a pending link resolved after
target creation, and title lookup returning a duplicate instead of the existing
note. JavaScript normalized internal whitespace, while SQL compared only trimmed
titles. SQL comparisons now use the same collapsed-space key without rewriting
the display title or note body.

The complete notes/attachments suite passed 15 tests. The lead then repeated the
three scenarios through authenticated HTTP on port 3113: links resolved,
get-or-create returned the original ID, and creating the target cleared the
pending link. Evidence: `docs/audit-whitespace-http.json`.

Cleanup: logout; removed exactly four QA notes and their session from
`sb_test_notes`; remaining QA note count zero. Port 3113 is closed and
`.next-note-regression` was removed.

One static check exposed an unrelated stale agent-generated validator under
`.next-audit-lead` that still imported the intentionally removed root page.
Removed only its obsolete `tsconfig` include entries, preserved the other
agent's files and active server, and regenerated canonical Next route types.

## Public login font repair

The login page requested `/fonts/PretendardVariable.woff2` without a session.
The gate returned 307 to `/login`, preventing the intended typeface from loading.
Allowed the public font directory without changing authentication requirements
for notes or APIs. Three focused proxy tests and scoped lint pass.

Real HTTP now returns 200, `font/woff2`, and a valid `wOF2` signature. The lead
also opened the real login page with omowright and inspected these captures:

- `.omo/evidence/font-gate/login-desktop.png`: 1440×900.
- `.omo/evidence/font-gate/login-mobile.png`: 390×844, touch/mobile emulation.

Pretendard Variable reported `loaded` in both. The mobile document width was
390px with no horizontal overflow. The login form was legible and did not
overlap. Full-app visual acceptance was still pending at that milestone; the
remaining footer/countdown/touch-target corrections were subsequently completed.

The first attempted capture borrowed a worker-owned server that stopped during
the run. Retried using the lead's own port3110 server. Both successful browser
sessions were closed, all owned `sb-font-qa.*` profiles removed, and port3110
was verified closed after stopping the server.

## Storage/retrieval integration regressions

A note saved by the notes service had a SHA-256 fingerprint, while search checked
PostgreSQL MD5. A deterministic regression proved that merely searching rebuilt a
fresh embedding. The notes writer now uses the same cache fingerprint as search.
This fingerprint is cache metadata, not authentication or encryption.

A second regression assigned three updates distinct microseconds within the same
millisecond. Pagination returned only the first note because its cursor rounded
the database timestamp through JavaScript Date. Cursors now preserve PostgreSQL
microseconds in a UTC string; display timestamps retain the existing wire shape.

Before: 21 passed, 2 failed. After: notes, attachments and search passed all 26
tests. Scoped lint passed. The final combined check below also passed typecheck.

## Chat compatibility and completion

The lead read all changed chat source and tests and reran the actual integration
suite. Old `{noteId,title,snippet?}` citations map into the new response shape
without rewriting stored JSON. Provider streams require `response.completed`;
failed, incomplete and delta-only EOF responses cannot persist partial answers.
Concurrent refreshes share one operation per auth file, whose replacement is
atomic and retains unrelated fields.

The backend and frontend SSE parser checks passed 29 tests. The frontend parser
had a TypeScript expectation containing `Citation | undefined`; the lead fixed
the expected array without suppressing the error. A test pinned to prompt prose
was replaced with assertions of the actual model/store/stream request fields.
These tests use local fixture streams, not a live paid provider.

## Logout failure feedback

In an owned browser, intercepting logout with HTTP 503 reproduced navigation to
`/login` with no error feedback. The shared shell now reports a persistent alert
and leaves the current page intact when logout fails.

The lead observed the alert and unchanged `/` URL, then viewed
`.omo/evidence/logout/failure-desktop.png` (1440x900) and
`failure-mobile.png` (390x844). The mobile document width remained 390px and the
alert stayed above bottom navigation. With interception removed, logout led to
`/login` and `/api/auth/me` returned 401.

## Bun standalone container acceptance

The Bun image built successfully with exit 0. It preserves the existing
deployment's `nextjs` UID 1001 rather than switching mounted files to UID 1000.
A local 0600 fake auth fixture demonstrated the difference: UID 1000 returned
EACCES, while UID 1001 read it successfully. No real auth file was used.

The lead ran the resulting image in production mode against a fresh isolated
database. Actual HTTP results:

- Login: 200.
- Note creation, title-target creation, persisted backlinks: successful.
- Search: 200 with keyword, fuzzy and textual-vector signals.
- Graph: 200 with two notes and their real link.
- Attachment upload: 201; download: 200 with identical bytes.
- Chat status: 200/available using the readable fake auth fixture only.
- Logout: 200.

Cleanup removed the QA container, image tag, database, fake auth fixture and
browser profiles. The stopped development server's exact home-audit session was
deleted (one row). Ports 3110, 3117 and the failed UI worker's 3156 were closed.
Canonical Next route types were regenerated and typecheck passed.

## Backend milestone before interface recovery

The lead ran this once:

```sh
TEST_DATABASE_URL=postgres://second_brain:second_brain@127.0.0.1:55432/second_brain_test \
  bun test src/server src/components/shell src/features/auth \
  src/features/chat/sse.test.ts src/proxy.test.ts
```

Result: **113 passed, 0 failed across 22 files**. Typecheck and scoped ESLint
also exited 0. This is a backend/shared-shell milestone, not final product QA.

The interface DAG initially had one accepted backend repair and six failed
frontend producers after InferHub returned `402 insufficient_balance` and
`503 billing_unavailable`. The provider-choice question timed out; the user
instructed completion using best judgment. The same DAG was amended to available
GPT routes, retaining the existing visual direction and accepted work. All eight
nodes completed. Their reports were followed by independent source inspection
and real browser acceptance, which found the additional defects below.

## Interface and integration repairs

- Notes discarded canonical save acknowledgements and could continue destructive
  actions after a failed flush. Drafts now retain newer edits, adopt canonical
  metadata, survive SPA navigation, and stop destructive actions on failure.
  Forced HTTP 503, route departure/return, retry, and dirty unload protection passed.
- A delayed attachment followed by editing and switching to preview overwrote
  the newer body. The same held-request scenario now inserts into the current
  draft and persists it. Upload/download bytes matched. Captured source URLs
  remain visible after promotion.
- Incomplete UTF-8 in a preview link threw `URIError`. URL query parsing now
  handles it without crashing. Title autocomplete includes preserved aliases.
  Trash, restore, confirmed purge and filter retention passed.
- Inbox Escape intercepted a modal's native cancellation. The listener now
  respects dialogs and native controls. Capture HTTP 503 retained the draft across
  closing/reopening; retry succeeded. Promotion was idempotent. Real
  `https://example.com` capture completed asynchronous text ingestion. Mobile
  triage now opens a dedicated detail view instead of burying it below the list.
- Graph tooltip HTML was interpreted as markup. Escaping makes it literal.
  Pin state now follows the current simulation data. Global/local depth, tags,
  fit/reset and accessible selection passed. The mobile inspector was below
  the viewport; it now scrolls into view above navigation.
- Search URL and input state drifted on history navigation. The URL now owns
  committed results. Keyword, tag, no-result, error, shortcut and back/forward
  flows passed. A hash collision returned an unrelated Korean note for `PARA`;
  literal n-gram verification removed that result without claiming semantic AI.
- Follow-up chat had accidentally depended on noisy retrieval hits. It now
  reloads prior cited active notes when a follow-up has no fresh matches;
  deleted/archived evidence is excluded. Malformed gateway JSON and an
  already-aborted stream no longer throw or retain a reader lock.
- A real GPT-6 Astra response produced eight real source cards and persisted
  both messages. A second request visibly streamed partial text; stopping it
  retained the question and left the database at two messages. Thread rename,
  create/delete, history reload and opening a citation passed. Token refresh
  was disabled while QA read the credentials.
- Chat and settings cached different shapes under the same status key, crashing
  SPA navigation. Both now use the plain response. Theme persisted after reload.
  Revoking all sessions made both the browser and a separately created QA
  session return 401. Wrong-password feedback and successful login passed.
- Daily actions and home now use the viewer's calendar/zone. A Seoul date that
  differed from UTC selected the correct daily note; invalid zones return 400.
  Home tests also passed with a Korean server timezone.
- The mobile shell added 60px of document overflow to fixed-height workspaces.
  Sizing now accounts for safe-area insets, reducing the document height from
  904px to the viewport's 844px and keeping chat headers and the composer visible.

## Verification limits

The host LSP resolver remained unavailable; passing `tsc`, ESLint, build and
browser evidence are the recorded checks. Jev was intentionally unconfigured
in QA, so optional failure behavior is verified but no live Jev classification
claim is made. Native mobile installation, offline operation and performance
scores are not claimed. No test used sleeps or retry-until-green logic.
