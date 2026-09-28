# Rebuild execution plan

Execution record: foundation and interface runs are complete, including root
integration repairs and production-build browser acceptance. This is the
historical plan, not a request to launch more workers. Final evidence and
limitations are recorded in `REBUILD-AUDIT.md`.

This is a HEAVY implementation, not an `ulw-plan` review workflow. The lead
performs integration verification and records self-review. Bun supersedes the
earlier npm/Vitest command names in the registered goal.

## Components and ownership

Six components can succeed independently: note storage/linking, capture/inbox,
retrieval, knowledge graph, grounded chat, and the application UI.
The lead owns shared contracts, authentication, migration compatibility,
deployment tooling, integration verification, browser QA, and delivery.

## Foundation phase (one mass-ulw run)

1. Notes (`deep-low`, transactional persistence/link resolution requires backend
   reasoning): implement note CRUD, tags, daily notes, attachment persistence,
   backlinks and unresolved links; test in `sb_test_notes`.
2. Search (`deep-low`, SQL ranking and indexing): implement FTS/trigram/vector
   RRF retrieval and related notes; test in `sb_test_search`.
3. Graph API (`deep-low`, graph projection and bounded traversal): implement
   global/local graph payloads, tag nodes and filtering; test in `sb_test_graph`.
4. Shell (`visual-engineering`, frontend specialty): build Korean responsive
   navigation, design tokens/primitives, command palette and login page.
5. Inbox (`deep-low`, transactional promotion and bounded external capture),
   after Notes: implement capture, optional Jev suggestions, triage APIs.
6. Chat (`deep-low`, existing Codex integration and streaming contract), after
   Search: implement grounded streaming chat with validated note citations.
7. Home/seed producer, after notes and inbox: implement the seeded example vault
   and home API consuming those services, and verify its fixture integration.
   It does not depend on the UI shell or review the lead's work.
8. Foundation verifier (`quick`), after all seven producers: run the combined
   checks and actual authenticated home endpoint, then record a bounded report.
   Completed producer work remains cached.

Scheduler outcome: the tool rejected the proposed dependency refinement in
steps 7-8 while the run was active. The original seven-node foundation later
completed without that amendment; no second writer was launched.

Write scopes are disjoint and specified in node prompts. Four initial lanes,
then dependency-gated producers and a final verifier fit the four-core workstation. The scheduler
owns admission limits. No team is needed: communication happens at phase
boundaries through code contracts and bounded reports.

## Interface phase (new run based on settled foundation evidence)

1. Notes workspace/editor: CodeMirror, save state, link completion, backlinks,
   unlinked mentions, tags, trash, daily note, attachment controls.
2. Capture/inbox UI: quick capture dialog and keyboard-accessible triage.
3. Graph UI: interactive global/local force graph, filters, hover neighbors,
   zoom and note navigation; replace the LocalGraph stub.
4. Search/chat UI: result navigation and cited streaming conversations.
5. Home/settings: useful dashboard, daily note entry and theme/session settings.
6. Integrate route/navigation behavior after all producers; lead verifies results.

## Verification and delivery

1. Inspect diffs and run diagnostics for all changed source files.
2. Run `bun run typecheck`, `bun run lint`, and `bun test` with local Postgres.
   No failures, warning suppressions, skipped regressions or prose-pinning tests.
3. Run `bun run build`; require exit 0.
4. Start the production build at `http://127.0.0.1:3100` with the seeded QA
   database, task-owned session, and development password `devpass`.
5. Browser scenario: login; create "QA Source" containing `[[QA Target]]`;
   create/open target; assert source appears in backlinks. Save and reload;
   assert the persisted body equals the entered body.
6. Browser scenario: capture "QA Inbox item"; promote it; assert it disappears
   from inbox and opens as a persistent note. Search that exact title and open
   the result. Test no-results and malformed/empty input handling.
7. Browser scenario: open global graph; assert real seeded nodes and edges;
   hover/select a node; open its note. Open local graph and change depth.
8. Browser scenario: chat loads; verify unavailable-model feedback when no
   credential exists, and exercise cited answers if the configured service works.
9. Capture and inspect screenshots at 1440x900 and 390x844; test mobile
   navigation, editor usability, dialogs, theme switch and overflow.
10. Preserve API response/status evidence for unauthenticated and malformed
    requests, migration-on-production-copy evidence, and all browser artifacts.
11. Clean up owned servers, browser sessions, QA files and local DB containers;
    never delete the live production database or alter its authentication.
12. Commit verified increments, push rebuild branch, create and merge PR only
    after checks pass. Report evidence, limitations, commit list and notepad path.

## Stop condition

Stop when Bun diagnostics/tests/build and real-surface scenarios pass, evidence
is recorded, owned QA resources are removed, and the verified rebuild is delivered
to GitHub. Never call a scaffold or a child's completion claim the finished app.

## User-directed research correction

The initial librarian report explicitly left many product claims unverified.
It is not adequate evidence of completed research. Before the interface phase,
run three independent primary-source lanes: graph/linking (Obsidian, Quartz,
Logseq), AI/search (Khoj, Reor), and capture/editor/navigation (Reader, AFFiNE,
SiYuan). A dependent writing lane produces a source-linked adoption matrix with
unknowns distinguished from verified behavior. No unverified renderer internals
or model capabilities may be presented as product facts.

The user explicitly assigns design to Claude models. The active foundation
shell worker was verified as Claude Fable 5.1 (InferHub, max). Later UI routes
failed with provider billing errors. After the provider-choice question timed
out, the user instructed completion using best judgment. The same interface
run recovered using available GPT workers while preserving the existing design,
as recorded in `INTERFACE-PLAN.md`. The user requested GPT-6 Astra Fast xhigh
for lead orchestration; the client selector was not verified or changed through
global model configuration.
