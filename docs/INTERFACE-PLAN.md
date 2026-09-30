# Interface implementation and acceptance

This historical document records the interface scope and acceptance scenarios
for the v2 rebuild. Implementation and integration verification were completed
during that rebuild. The requirements below are not a current release roadmap.
Observed defects, repairs and verification limits are in
[REBUILD-AUDIT.md](REBUILD-AUDIT.md).

## Implementation scope

The six feature areas shared the same design tokens, UI primitives,
authentication and database contracts. Shared dependencies and cross-feature
changes required integration checks, not just isolated page verification.
Chat compatibility and stream reliability were verified alongside the
interfaces without changing published wire types.

Related references:
[architecture](ARCHITECTURE.md),
[product research](research/ADOPTION.md),
[wire types](../src/lib/types.ts) and
[UI primitives](../src/components/ui/README.md).

### Notes workspace

Scope: `src/features/notes/**`, `src/app/(app)/notes/**` and
`src/app/(app)/daily/**`.

- Implement the note list, search/tag/pinned/archive/trash views and pagination.
- Build a CodeMirror Markdown editor, controls for titles, tags and aliases,
  and a safe GFM preview. `[[` completion uses real note-title results.
- Autosave must retain edits made while a request is running, serialize writes,
  and never replace dirty text with a stale SWR response or another note's body.
  Provide visible saved/saving/failed states and a real retry action.
- Following a wikilink opens the existing note or explicitly creates the missing
  target through `/api/notes/by-title`. Preserve display labels.
- Show backlinks, outgoing/unresolved links, unlinked mentions and related notes.
  Related-note vectors represent textual similarity, not learned semantic AI.
- Use the graph component's existing `LocalGraph({noteId, depth?, height?})` contract.
- Connect pin, archive, trash, restore, purge and attachment upload controls to
  their actual APIs.
- `/daily` creates or opens the note for the selected local calendar date.
- Test save sequencing at a meaningful integration boundary where practical;
  don't assert prose or mock away the persistence behavior under test.

Browser acceptance: create `QA Source` containing `[[QA Target]]`, follow the
target, confirm the backlink, edit while a save is pending, reload and confirm the
latest body. Check tag filters, trash/restore and mobile editor overflow.

### Capture and inbox

Scope: `src/features/capture/**`, `src/features/inbox/**` and
`src/app/(app)/inbox/**`.

- Replace the CaptureDialog stub while preserving `open`/`onOpenChange` props.
- Capture text or URLs without requiring categorization. Preserve input on
  failure and show confirmed server success before clearing the form.
- Connect inbox selection, promotion and confirmed discard to their real endpoints.
- Keyboard navigation and triage must not intercept typing in forms or editors.
- Distinguish pending, unavailable and failed Jev suggestions; apply proposed tags
  only when the user selects them. Refresh inbox badges and affected caches.
- Provide loading, empty and retry states without fake sample data.

Browser acceptance: open capture from the shell, save a unique text item, see it
in Inbox, promote it, and open the resulting persistent note. Repeat promotion
without producing a duplicate. Exercise this without AI credentials.

### Knowledge graph

Scope: `src/features/graph/**` and `src/app/(app)/graph/**`.

- Replace LocalGraph and build the full graph with `react-force-graph-2d`,
  client-only loading and a correctly sized responsive canvas.
- Consume the real GraphData response; don't substitute a hardcoded node map.
- Support global/local mode, depth 1/2/3, tag filtering, tag nodes and orphans.
- Highlight hovered/selected neighbors, scale note size by degree, and use
  stable tag colors with an explanatory legend.
- Support pan/zoom, fit/reset, node dragging/pinning and clearing the selection.
- A selected-node inspector must open the actual note; unresolved targets have
  an explicit create/open action. Provide an accessible list alternative.
- Clone data before handing it to the mutating force-graph library. Stop settled
  simulations and respect reduced motion. Don't claim unmeasured performance.

Browser acceptance: a seeded graph has real nodes and edges; selecting a node
shows its neighbors and opens that note. Local depth changes the fixture's
visible neighborhood. Filters and reset work at desktop and mobile widths.

### Search

Scope: `src/features/search/**` and `src/app/(app)/search/**`.

- Use URL query state and the actual `/api/search` response.
- Show ranked titles, snippets, tags and timestamps with keyboard-accessible
  note navigation. Prevent slow responses to older queries from replacing newer results.
- Support tag filters, no-results, empty-query, loading and retry states.
- Translate the legacy `matchedBy: "semantic"` token to truthful textual
  similarity copy. Don't advertise a learned embedding model.

Browser acceptance: search the captured note's exact title, open the expected
result, verify a nonsense query has no results, and test a Korean query.

### Cited chat

Scope: `src/features/chat/**` and `src/app/(app)/chat/**`.

- Implement a persistent thread list with create, rename and delete actions,
  and retain message history.
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

Scope: `src/features/home/**`, `src/features/settings/**`,
`src/app/(app)/page.tsx` and `src/app/(app)/settings/**`.

- Replace the temporary landing page with real HomeData: inbox preview, recent/pinned
  notes, today's note, resurfacing and accurate counts.
- Prioritize useful actions and reading hierarchy over promotional hero cards.
  Empty sections should invite an action, not show synthetic statistics.
- Wire theme controls to the existing shell theme store.
- Show actual session expiry and use the real logout/revoke-all endpoints with
  confirmation where appropriate.
- Explain optional AI and installation behavior accurately; don't add unwired
  export, backup, offline or configuration buttons.

Browser acceptance: dashboard counts reflect seed data; notes open and daily
capture works. The theme survives navigation/reload; logout returns to login and
revoked sessions cannot access protected routes.

## Final verification requirements

Run `bun run typecheck`, `bun run lint`, relevant Bun tests, and
`bun run build`. Record exact failures without suppressing them.
Verify all intended route files exist and no feature stub remains.
Execute the complete 1440×900 / 390×844 browser matrix against the production
build, inspect every screenshot and fix observed defects. Stop QA servers and
browsers and record cleanup. Keep production data, deployment and authentication
outside the QA environment.

## Chat compatibility and stream reliability

Scope: `src/server/chat/**` and its tests.
Legacy stored citations used `{noteId, title, snippet?}`; the rebuilt reader
required `{index, noteId, title, excerpt}`. The compatibility requirement was to
preserve old conversations by mapping legacy citations to the new wire shape
without rewriting stored data.

At the start of the rebuild, the provider adapter treated a delta-only EOF as
success. The repair requirements were to accept only a genuine successful
Responses completion, reject failed, incomplete or truncated streams, and
verify that service rollback remained intact. Concurrent expired-token sends
had to share refresh for the same auth file, following the prior implementation's
single-flight pattern. Refreshed auth had to be persisted atomically while
preserving unrelated file fields. All tests used deterministic local streams
and files, with no real credentials or upstream calls.

Integration checks also covered note/search fingerprint alignment and shared-shell
logout failure feedback. These repairs didn't change frontend response types.
