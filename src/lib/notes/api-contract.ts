/**
 * Expected Rex/Kai HTTP contract (UI consumer only — no server impl in E2 UI lane).
 *
 * GET    /api/notes?cursor=           → 200 NoteListResponse
 * POST   /api/notes                   → 201 Note  body: { title, body }
 * GET    /api/notes/:id               → 200 Note
 * PATCH  /api/notes/:id               → 200 Note  body: { title, body }
 * DELETE /api/notes/:id               → 200 Note (trashedAt set)
 * POST   /api/notes/:id/restore       → 200 Note (trashedAt null)
 *
 * POST   /api/capture                 → 201 { id, target: "inbox"|"note" }
 *   multipart: title, body, mode, url?, file?
 *   or JSON for text-only
 */

export const NOTES_API = {
  list: "/api/notes",
  item: (id: string) => `/api/notes/${id}`,
  restore: (id: string) => `/api/notes/${id}/restore`,
} as const;

export const CAPTURE_API = "/api/capture";
