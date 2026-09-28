# Interface implementation phase

Execution record: the interface DAG completed all eight nodes. The lead then
reproduced and repaired integration defects and verified the real interfaces.
The topology below is historical implementation guidance, not an instruction
to launch another run. Current evidence is in `docs/REBUILD-AUDIT.md`.

Start this as a NEW mass-ulw run after the foundation run settles and its
artifacts pass lead inspection. Read `docs/ARCHITECTURE.md`,
`docs/research/ADOPTION.md`, `src/lib/types.ts` and
`src/components/ui/README.md` before implementation.

## Topology and ownership

The original six frontend producers used `visual-engineering`. That provider
failed with billing errors, including a focused retry after the question timed
out. The continuation instruction asks the lead to use its best judgment and
finish without asking again. Recovery preserves the existing Claude-designed
tokens and primitives: notes, capture, graph and chat use the available
`deep-low` integration workers; search and the already-written home/settings
completion use `quick`. This is an execution fallback, not a new visual direction.
Each owns its implementation and targeted tests. No producer changes package
dependencies, shared tokens, shared
primitives, authentication, database schemas or backend services.

The six UI scopes are disjoint. A backend chat-compatibility lane also runs
independently, without changing the published wire types. A final `quick`
verification node depends on all seven and executes checks rather than repeating
their claims. The lead retains
cross-domain fixes, final browser QA, Docker verification and GitHub delivery.
The scheduler admits work according to its configured slots; do not combine
independent pages just to reduce the node count.

### Notes workspace

Write only `src/features/notes/**`, `src/app/(app)/notes/**` and
`src/app/(app)/daily/**`.

- Implement the note list, search/tag/pinned/archive/trash views and pagination.
- Build a CodeMirror Markdown editor, title/tags/aliases controls and safe GFM
  preview. `[[` completion uses real note-title results.
- Autosave must retain edits made while a request is running, serialize writes,
  and never replace dirty text with a stale SWR response or another note's body.
  Provide visible saved/saving/failed states and a real retry action.
- Following a wikilink opens the existing note or explicitly creates the missing
  target through `/api/notes/by-title`. Preserve display labels.
- Show backlinks, outgoing/unresolved links, unlinked mentions and related notes.
  Related-note vectors are textual similarity, not learned semantic AI.
- Use the graph lane's existing `LocalGraph({noteId, depth?, height?})` contract.
- Wire actual pin/archive/trash/restore/purge and attachment upload APIs.
- `/daily` creates/opens the selected local calendar date's note.
- Test stateful save sequencing at a meaningful seam where practical; do not
  assert prose or mock away the persistence behavior under test.

Browser acceptance: create `QA Source` containing `[[QA Target]]`, follow the
target, confirm backlink, edit while save is pending, reload and confirm the
latest body. Check tag filters, trash/restore and mobile editor overflow.

### Capture and inbox

Write only `src/features/capture/**`, `src/features/inbox/**` and
`src/app/(app)/inbox/**`.

- Replace the CaptureDialog stub while preserving `open`/`onOpenChange` props.
- Capture text or URLs without mandatory categorization. Preserve input on
  failures and show actual server success before clearing the form.
- Wire inbox selection, promote and confirmed discard to their real endpoints.
- Keyboard navigation/triage must not intercept typing in forms/editors.
- Show pending/unavailable/failed Jev suggestions honestly; apply proposed tags
  only when the user selects them. Refresh inbox badges and affected caches.
- Provide loading, empty and retry states without fake sample data.

Browser acceptance: open capture from the shell, save a unique text item, see it
in Inbox, promote it, and open the resulting persistent note. Repeat promotion
without producing a duplicate. Exercise this without AI credentials.

### Knowledge graph

Write only `src/features/graph/**` and `src/app/(app)/graph/**`.

- Replace LocalGraph and build the full graph with `react-force-graph-2d`,
  client-only loading and a correctly sized responsive canvas.
- Consume the real GraphData response; never substitute a hardcoded node map.
- Support global/local mode, depth 1/2/3, tag filtering, tag nodes and orphans.
- Highlight hovered/selected neighbors, scale note size by degree, and use
  stable tag colors with an explanatory legend.
- Support pan/zoom, fit/reset, node dragging/pinning and clear selection.
- A selected-node inspector must open the actual note; unresolved targets have
  an explicit create/open action. Provide an accessible list alternative.
- Clone data before handing it to the mutating force-graph library. Stop settled
  simulations and respect reduced motion. Do not claim unmeasured performance.

Browser acceptance: a seeded graph has real nodes and edges; selecting a node
shows its neighbors and opens that note. Local depth changes the fixture's
visible neighborhood. Filters and reset work at desktop and mobile widths.

### Search

Write only `src/features/search/**` and `src/app/(app)/search/**`.

- Use URL query state and the actual `/api/search` response.
- Show ranked titles, snippets, tags and timestamps with keyboard-accessible
  note navigation. Prevent slower old queries from replacing newer results.
- Support tag filters, no-results, empty-query, loading and retry states.
- Translate the legacy `matchedBy: "semantic"` token to truthful textual
  similarity copy. Do not advertise a learned embedding model.

Browser acceptance: search the captured note's exact title, open the expected
result, verify a nonsense query has no results, and test a Korean query.

### Cited chat

Write only `src/features/chat/**` and `src/app/(app)/chat/**`.

- Implement persistent thread list/create/rename/delete and message history.
- Check `/api/chat/status`; unavailable configuration must be visible rather
  than a fabricated answer or an unexplained disabled control.
- Parse real incremental SSE `citations`, `delta`, `done` and `error` events,
  including fragmented UTF-8/CRLF boundaries. A stream ending without `done` is
  not a successful answer.
- Preserve the user's text on failures; prevent duplicate sends and abort an
  obsolete stream when switching threads.
- Render Markdown safely and provide source cards linked to actual note IDs.
  Never create citations in the client or treat retrieved text as HTML.
- Add deterministic parser regression tests with realistic fragmented frames.

Browser acceptance: create a thread, send a note-grounded question, observe
streaming and open a real citation. Reload to recover history. Also verify the
unconfigured/error state without inventing an assistant message.

### Home and settings

Write only `src/features/home/**`, `src/features/settings/**`,
`src/app/(app)/page.tsx` and `src/app/(app)/settings/**`.

- Replace the temporary landing with real HomeData: inbox preview, recent/pinned
  notes, today's note, resurfacing and accurate counts.
- Prioritize useful actions and reading hierarchy over promotional hero cards.
  Empty sections should invite an action, not show synthetic statistics.
- Wire theme controls to the existing shell theme store.
- Show actual session expiry and use the real logout/revoke-all endpoints with
  confirmation where appropriate.
- Explain optional AI and install behavior truthfully; do not add unwired
  export, backup, offline or configuration buttons.

Browser acceptance: dashboard counts reflect seed data; opening notes and daily
capture works. Theme survives navigation/reload; logout returns to login and
revoked sessions cannot access protected routes.

## Final phase verification

Run `bun run typecheck`, `bun run lint`, relevant Bun tests, and
`bun run build`. Capture exact failures and do not suppress them.
Verify all intended route files exist and no feature stub remains.
The lead then executes the complete 1440×900 / 390×844 browser matrix against
the final production build, inspects every screenshot and fixes observed defects.
Every lane stops its own server/browser and records cleanup. Production data,
deployment and authentication are outside the QA environment.

## Chat compatibility and stream reliability

Backend lane (`deep-low`): write only `src/server/chat/**` and its tests.
The old stored citation shape is `{noteId, title, snippet?}`; the new reader
requires `{index, noteId, title, excerpt}`. Preserve old conversations by mapping
legacy citations to the new wire shape without rewriting stored data.

The provider currently treats a delta-only EOF as success. Require a genuine
successful Responses completion and reject failed/incomplete/truncated streams;
prove service rollback remains intact. Concurrent expired-token sends must
share refresh for the same auth file, following the prior implementation's
single-flight pattern. Persist refreshed auth atomically and preserve unrelated
file fields. All tests use deterministic local streams/files and no real
credentials or upstream calls.

The lead separately owns note/search fingerprint alignment and shared-shell
logout failure feedback. These repairs do not change frontend response types.
