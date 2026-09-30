# Research decisions for the rebuild

Checked 2026-09-27. These are implementation decisions, not claims that this app
already implements them. Product facts come from the three neighboring evidence
tables; lead independently retrieved the consequential sources below.
The original broad librarian report was insufficient. Both synthesis-worker
attempts returned without this file, so the lead produced the matrix from
verified source reports rather than accepting a completion flag.

## Evidence to implementation

| Decision | Observed reference | Implementation target | Browser proof |
| --- | --- | --- | --- |
| Separate global and current-note graphs | [Obsidian graph](https://raw.githubusercontent.com/obsidianmd/obsidian-help/master/en/Plugins/Graph%20view.md), graph-links rows 1, 4 | `features/graph`, `/api/graph` | Open global graph, then a note's local graph; local nodes are its neighborhood. |
| Make local depth explicit and bidirectional | [Quartz graph source](https://github.com/jackyzha0/quartz/blob/v4/quartz/components/scripts/graph.inline.ts), graph-links row 5 | Local inspector depth 1/2/3 | Fixture A→B→C: depth 1 excludes C; depth 2 includes C; selecting B includes A. |
| Keep graph controls useful rather than decorative | [Obsidian graph](https://raw.githubusercontent.com/obsidianmd/obsidian-help/master/en/Plugins/Graph%20view.md), graph-links row 2 | Tag/orphan filters, clear selection, reset view | Toggle orphan display and tag filter; visible graph and count both change. |
| Use color to communicate grouping | Same Obsidian Groups section | Stable tag color with textual legend | Notes sharing a tag share a stable group color; labels still identify them without color. |
| Treat tag nodes as an optional graph layer | [Quartz graph source](https://github.com/jackyzha0/quartz/blob/v4/quartz/components/scripts/graph.inline.ts), graph-links row 6 | `tags=1`, graph controls | Toggle tags; note content is unchanged and edges have valid endpoints. |
| Support readable wikilinks and display labels | [Obsidian internal links](https://raw.githubusercontent.com/obsidianmd/obsidian-help/master/en/Linking%20notes%20and%20files/Internal%20links.md), graph-links row 3 | Markdown editor, link parser, preview | Save `[[Target|Label]]`; preview shows Label and opens Target. |
| Missing link targets remain meaningful | Same internal-links source | Unresolved-link styling and explicit create/open action | Follow `[[New target]]`, create its note, and see the old source become a backlink. |
| Capture first, organize later | [Reader adding content](https://docs.readwise.io/reader/docs/faqs/adding-new-content), capture-editor rows 1–3 | Capture dialog and inbox | Capture text without title/tags; it persists in Inbox before classification. |
| Use explicit review actions, not mandatory taxonomy | Same Reader Library/Feed distinction | Promote to note, discard, clear pending state | Promote an inbox item once; repeating the request does not create a duplicate note. The exact action set is our recommendation, not Reader parity. |
| Commands are discoverable and optional | [Reader navigation](https://docs.readwise.io/reader/docs/faqs/navigation), capture-editor row 4 | Cmd/Ctrl+K palette, shortcut hints, ordinary buttons | Open palette by keyboard, find note/action, activate with Enter, dismiss with Escape; buttons offer the same actions. |
| Mobile must not depend on desktop shortcuts | Same Reader mobile settings evidence, rows 4–5 | Bottom navigation, visible touch actions, responsive editor | At 390px, capture and triage work without keyboard or swipe gestures. This layout is our choice, not a copied Reader layout. |
| Citations open the actual stored source | [Reor source cards](https://github.com/reorproject/reor/blob/main/src/components/Chat/MessageComponents/ChatSources.tsx), ai-retrieval rows 3, 7 | Chat source cards backed by retrieved note IDs | Click an answer citation; opened note matches its title and quoted excerpt. Reject invented source IDs. |
| Keep optional AI separate from ordinary work | [Khoj search configuration](https://github.com/khoj-ai/khoj/blob/master/documentation/docs/features/search.md), ai-retrieval rows 1–4 | Search, capture and model-status state | Without model credentials, notes, capture and ordinary search still work; chat explains configuration rather than showing a fake answer. Failure-state UX is our recommendation. |
| Label lexical vectors honestly | [Reor learned embeddings](https://github.com/reorproject/reor/blob/main/electron/main/vector-database/embeddings.ts), ai-retrieval rows 5–6 | Search labels, README, related-note explanation | Hashed n-gram results are called textual similarity, not meaning-based AI. Any future semantic claim requires an actual learned embedding model and reindexing. |

## Renderer choice and limits

Quartz currently imports D3 and Pixi.js; that does not establish Obsidian's
renderer. This rebuild already has `react-force-graph-2d`, which uses a canvas
surface suitable for a bounded graph. This is an engineering choice, not a
competitor attribution. Confirm mobile behavior with the actual dataset,
reduced motion and a usable list/inspector alternative. Do not claim a
2,000-node performance guarantee without measuring it.

## Deliberately not copied

- AFFiNE's [slash command](https://docs.affine.pro/core-concepts/elements-of-affine/slash-command)
  is verified to start in a blank block. Its broad block/workspace model is not
  needed for a Markdown-first single-owner notebook. A small insertion menu can
  be considered only if it improves the implemented editor.
- Reader's RSS Feed, subscription delivery, EPUB/video ingestion and separate
  Seen/Unseen feed model are outside this rebuild's capture contract.
- Logseq-specific graph keyboard controls and SiYuan Markdown round-trip/export
  details remain unverified. No parity or storage-format claims are adopted.
- Backlinks and alias matching are explicit app requirements and documented app
  contracts. The fetched graph/link pages do not establish all competitor edge
  cases; our own rename, deletion and ambiguity tests decide these behaviors.
- Do not advertise local storage as fully offline AI. Reor supports both local
  model execution and remote-compatible services.

## Five consequences for implementation

1. A graph must help open and understand notes, not merely animate particles.
2. Capture must survive missing or failing AI and defer metadata decisions.
3. Editor links, backlinks and unresolved targets form one persistent workflow.
4. Search result identity must survive retrieval, chat generation and citation clicks.
5. Korean mobile workflows need visible actions and truthful status, not desktop
   shortcuts or inflated AI labels.
