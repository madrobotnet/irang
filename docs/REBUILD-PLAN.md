# Historical v2 rebuild implementation plan

This historical plan covers the v2 foundation, interfaces and integration
repairs. Implementation and production-build browser acceptance were completed
during that rebuild. The steps below preserve the original requirements, not
current-release setup instructions.
Recorded results and limits are in [REBUILD-AUDIT.md](REBUILD-AUDIT.md).
Bun is the package manager, script runner, test runner and application runtime.

## Components

Six components could be developed separately: note storage/linking, capture/inbox,
retrieval, the knowledge graph, grounded chat and the application UI.
Shared contracts, authentication, migration compatibility and deployment tooling
required checks across components, followed by integration and browser verification.

## Foundation phase

1. Notes: implement note CRUD, tags, daily notes, attachment persistence,
   backlinks and unresolved links; test in `sb_test_notes`.
2. Search: implement FTS/trigram/vector RRF retrieval and related notes;
   test in `sb_test_search`.
3. Graph API: implement global/local graph payloads, tag nodes and filtering;
   test in `sb_test_graph`.
4. Shell: build responsive Korean navigation, design tokens and primitives,
   the command palette and the login page.
5. Inbox, after notes: implement capture, optional Jev suggestions and triage APIs.
6. Chat, after search: implement grounded streaming chat with validated note citations.
7. Home/seed, after notes and inbox: implement the seeded example vault
   and a home API that uses those services, then verify fixture integration.
8. Foundation verification, after all components: run the combined
   checks, exercise the actual authenticated home endpoint and record the evidence.

## Interface phase

1. Notes workspace/editor: CodeMirror, save state, link completion, backlinks,
   unlinked mentions, tags, trash, daily notes and attachment controls.
2. Capture/inbox UI: quick capture dialog and keyboard-accessible triage.
3. Graph UI: interactive global/local force graph, filters, neighbor highlighting on hover,
   zoom and note navigation; replace the LocalGraph stub.
4. Search/chat UI: result navigation and cited streaming conversations.
5. Home/settings: useful dashboard, daily note entry and theme/session settings.
6. Integrate route and navigation behavior after all feature areas pass their checks.

## Verification and delivery requirements

1. Inspect diffs and run diagnostics for all changed source files.
2. Run `bun run typecheck`, `bun run lint`, and `bun test` with local PostgreSQL.
   Require clean checks. Don't suppress warnings, skip regressions or pin prose in tests.
3. Run `bun run build`; require exit 0.
4. Start the production build at `http://127.0.0.1:3100` with the seeded QA
   database, a QA session and the development password `devpass`.
5. Browser scenario: log in; create "QA Source" containing `[[QA Target]]`;
   create/open the target; confirm the source appears in backlinks. Save and reload;
   assert the persisted body equals the entered body.
6. Browser scenario: capture "QA Inbox item"; promote it; assert it disappears
   from the inbox and opens as a persistent note. Search that exact title and open
   the result. Test no-results and malformed/empty input handling.
7. Browser scenario: open global graph; assert real seeded nodes and edges;
   hover/select a node; open its note. Open local graph and change depth.
8. Browser scenario: chat loads; verify unconfigured-chat feedback when no
   credential exists, and exercise cited answers if the configured service works.
9. Capture and inspect screenshots at 1440x900 and 390x844; test mobile
   navigation, editor usability, dialogs, theme switch and overflow.
10. Preserve API response/status evidence for unauthenticated and malformed
    requests, evidence of migrations run on a production-data copy, and all browser artifacts.
11. Clean up QA servers, browser sessions, files and local DB containers;
    never delete the live production database or alter its authentication.
12. Prepare delivery only after checks pass. Report evidence, limitations and
    verified changes.

## Historical acceptance condition

The rebuild's acceptance condition was that diagnostics, Bun tests, the production
build and real-interface scenarios passed, evidence was recorded and QA resources
were removed. Scaffolds and completion reports alone did not establish acceptance.

## Research evidence

Product research drew on primary sources in three areas: graph/linking (Obsidian,
Quartz, Logseq), AI/search (Khoj, Reor), and capture/editor/navigation (Reader,
AFFiNE, SiYuan). The [adoption matrix](research/ADOPTION.md) separates verified
behavior from unknowns. Unverified renderer internals and model capabilities
must not be presented as product facts.
