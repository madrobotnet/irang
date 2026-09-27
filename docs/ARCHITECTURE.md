# Second Brain v2 — Architecture

Single-owner, self-hosted second brain. **Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS 4, Postgres 18 + pgvector + pg_trgm, Bun** (package manager, script runner, test runner, and production runtime).

Flow: **capture → inbox triage → linked markdown notes → search / graph / AI chat over your notes.**

## Commands

| Command | Purpose |
| --- | --- |
| `bun install` | install (lockfile `bun.lock`) |
| `bun run db:up` / `bun run db:down` | local pgvector Postgres on `127.0.0.1:55432` (docker-compose.dev.yml) |
| `bun run dev` | dev server (`bun --bun next dev`) |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run lint` | `eslint .` |
| `bun test` | unit + Postgres integration tests (`bun:test`, needs `db:up`) |
| `bun run build` / `bun run start` | production build / start |
| `bun run seed` | seed demo notes into `DATABASE_URL` |

## Layout

```
src/
  proxy.ts                     cookie gate (Next 16 "proxy" = old middleware)
  app/
    layout.tsx, globals.css    root, fonts, design tokens
    login/                     login page
    (app)/layout.tsx           authenticated shell (server: getSession() else redirect)
    (app)/page.tsx             home dashboard
    (app)/notes/, (app)/notes/[id]/, (app)/daily/, (app)/inbox/, (app)/search/,
    (app)/graph/, (app)/chat/, (app)/chat/[id]/, (app)/settings/
    api/**/route.ts            JSON APIs (all wrapped with withApi / withPublicApi)
  components/ui/               design-system primitives (Button, Input, Dialog, Sheet, Badge, Kbd, Skeleton, EmptyState, Toast)
  components/shell/            Sidebar, MobileNav, CommandPalette, ShellProvider
  features/<area>/             client feature components per area
  lib/                         isomorphic: types.ts (wire types), api-client.ts, markdown/wikilink helpers
  server/                      server-only modules per area; db/, auth/, http.ts, jev/
```

## Core contracts (already implemented — use, do not rewrite)

- `src/server/db/index.ts`: `db()`, `query<T>(sql, params)`, `queryOne<T>()`, `tx(fn)`, `closeDb()`. Migrations in `src/server/db/migrations.ts` run automatically on first use. **Schema changes = append a new migration** (never edit `0001`).
- `src/server/http.ts`: `withApi(handler)` (session required), `withPublicApi`, `ApiError(code, message)`, `json()`, `parseJson(request, zodSchema)`. Error body: `{ error: { code, message } }`.
- `src/server/auth/session.ts`: `getSession()`; cookie `sb_session`.
- `src/server/jev/client.ts`: `getJev()` returns a TypeSafe client or `null`. **Jev is optional: null or a thrown error must never fail a user action.**
- `src/lib/types.ts`: every API response type. `src/lib/api-client.ts`: `api<T>(path, { method, json })`, `fetcher` for SWR, `ApiClientError`.
- `src/server/test/db.ts`: `useTestDatabase()`, `resetData()`, `closeDb()` for integration tests.

## Data model (Postgres, compatible with v1 production tables)

- `notes(id, title, body markdown, status, tags text[], aliases text[], pinned, source_url, daily_date, created_at, updated_at, deleted_at, search_embedding vector(128), search_source_hash, search_tsv generated)`. Archived = `status = 'archived'`. Trash = `deleted_at IS NOT NULL`.
- `links(from_note_id, to_note_id, relation='link')` — materialized from `[[wikilinks]]` on every note write.
- `unresolved_links(from_note_id, target_title)` — `[[targets]]` with no matching note; resolved when a note with that title/alias is created or renamed.
- `inbox_items(id, title, body, source web|url|share|api, url, promoted_note_id, discarded_at, suggestions jsonb, created_at)`.
- `attachments(id, note_id?, filename, mime, size_bytes, storage_key)` stored under `ATTACHMENTS_DIR` (default `.data/attachments`).
- `chat_threads`, `chat_messages(role, content, citations jsonb)`.

## Wikilink rules (src/lib/wikilinks.ts)

- Syntax `[[Target]]`, `[[Target|label]]`, `[[Target#Heading]]`. Target matching is case-insensitive against note title or any alias, trimmed.
- Tags: `#tag` in body (letters incl. Hangul, digits, `-`, `_`, `/`; not inside code) are merged with explicit `tags` (lower-cased, deduped).
- Rendering: wikilinks become links to `/notes/<id>`; unresolved ones render dimmed and clicking creates the note.

## HTTP API

| Method & path | Body / query | Response |
| --- | --- | --- |
| POST `/api/auth/login` | `{password}` | `{ok}` + cookie; 429 `{retryAfterSeconds}` |
| POST `/api/auth/logout`, POST `/api/auth/sessions/revoke-all`, GET `/api/auth/me` | | `{ok}` |
| GET `/api/notes` | `?q=&tag=&pinned=1&archived=1&trash=1&limit=50&cursor=` | `{notes: NoteSummary[], nextCursor: string\|null}` |
| POST `/api/notes` | `{title?, body?, tags?}` | `{note: Note}` (title defaults to "제목 없음" + n) |
| GET/PATCH/DELETE `/api/notes/:id` | PATCH `{title?, body?, tags?, aliases?, pinned?, archived?}` | `{note: Note}`; DELETE = move to trash |
| POST `/api/notes/:id/restore` | | `{note}` |
| DELETE `/api/notes/:id?purge=1` | | permanent delete (only when in trash) |
| GET `/api/notes/:id/links` | | `NoteLinks` |
| GET `/api/notes/:id/related` | | `{notes: RelatedNote[]}` (semantic neighbours) |
| GET `/api/notes/titles` | `?q=&limit=10` | `{notes: NoteRef[]}` — quick switcher and `[[` autocomplete |
| POST `/api/notes/by-title` | `{title}` | `{note}` get-or-create (clicking an unresolved link) |
| POST `/api/daily` | `{date?: YYYY-MM-DD}` | `{note}` get-or-create daily note |
| GET `/api/tags` | | `{tags: TagCount[]}` |
| POST `/api/attachments` | multipart `file` (≤ 25 MB), `noteId?` | `{id, url, filename, mime, markdown}` |
| GET `/api/attachments/:id` | | file bytes |
| POST `/api/capture` | `{text?, url?, title?}` | `{item: InboxItem}` (Jev suggestions run after the insert, best-effort) |
| POST `/api/capture/share` | PWA share-target form | 303 → `/inbox` |
| GET `/api/inbox` | | `{items: InboxItem[], count}` |
| POST `/api/inbox/:id/promote` | `{title?, body?, tags?}` | `{note}` |
| POST `/api/inbox/:id/discard` | | `{ok}` |
| POST `/api/inbox/:id/suggest` | | `{item}` (re-run Jev) |
| GET `/api/search` | `?q=&tag=&limit=20` | `SearchResponse` |
| GET `/api/graph` | `?focus=<noteId>&depth=1..3&tags=1&orphans=1&tag=<filter>` | `GraphData` |
| GET `/api/chat/status` | | `{available: boolean}` |
| GET/POST `/api/chat/threads` | POST `{title?}` | `{threads}` / `{thread}` |
| GET/PATCH/DELETE `/api/chat/threads/:id` | PATCH `{title}` | `{thread, messages}` |
| POST `/api/chat/threads/:id/messages` | `{content}` | `text/event-stream`: `citations` (Citation[]), `delta` ({text}), `done` ({message: ChatMessage}), `error` ({code, message}) |
| GET `/api/home` | | `HomeData` |
| GET `/api/health` | public | `{ok}` |

## Design system (Direction A — "desk")

Owner's locked taste: warm parchment desk, matte cards, charcoal rail, terracotta accent. Korean UI copy. Font: Pretendard Variable (self-hosted from the `pretendard` package), `font-feature-settings: "ss06"`; mono: system ui-monospace.

CSS variables in `globals.css` (light / `.dark`), exposed to Tailwind 4 via `@theme inline`:

| Token | Light | Dark |
| --- | --- | --- |
| `--canvas` | `#efe8dc` | `#141210` |
| `--desk` (panels) | `#f7f2ea` | `#1c1917` |
| `--card` | `#fffcf7` | `#231f1c` |
| `--ink` | `#1c1917` | `#f3ede4` |
| `--mute` | `#78716c` | `#a8a29e` |
| `--line` | `#e4dccf` | `#35302b` |
| `--accent` | `#c45c26` | `#e07a45` |
| `--accent-soft` | `#f6e3d6` | `#3a2519` |
| `--rail` | `#2a2622` | `#0f0d0c` |
| `--rail-ink` | `#e9e2d6` | `#e9e2d6` |
| `--ok` / `--warn` / `--danger` | `#3f7d4e` / `#b7791f` / `#b42318` | lighter variants |

Tailwind names: `bg-canvas bg-desk bg-card text-ink text-mute border-line bg-accent text-accent bg-accent-soft bg-rail text-rail-ink`. Radius 10px cards / 8px controls, soft shadow `0 1px 2px rgb(28 25 23 / .06), 0 4px 16px rgb(28 25 23 / .05)`. Touch targets ≥ 44px on mobile. Focus ring `ring-2 ring-accent/40`.

Shell: desktop (≥ 1024px) = 64px charcoal icon rail (expands to 220px with labels) + content; mobile = top bar + bottom nav (홈 · 노트 · [캡처 FAB] · 검색 · 더보기). Nav: 홈 `/`, 인박스 `/inbox` (badge = open count), 노트 `/notes`, 오늘 `/daily`, 검색 `/search`, 그래프 `/graph`, 채팅 `/chat`, 설정 `/settings`.

Keyboard: `Ctrl/⌘+K` command palette (notes by title + actions), `Ctrl/⌘+P` quick switcher (same palette in note mode), `c` or `Ctrl/⌘+Shift+Space`… capture dialog, `g h/i/n/s/g/c` go-to, `/` focus search. Shortcuts are ignored while typing in inputs/editors.
