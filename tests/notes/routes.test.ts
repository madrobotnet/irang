import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, it } from "node:test";
import { z } from "zod";
import { DELETE, GET as GET_ONE, PATCH } from "../../src/app/api/notes/[id]/route";
import { POST as RESTORE } from "../../src/app/api/notes/[id]/restore/route";
import { GET as LIST, POST as CREATE } from "../../src/app/api/notes/route";
import { GET as TRASH } from "../../src/app/api/notes/trash/route";
import { createSession } from "../../src/lib/auth/session";
import { parseNoteId, RESTORE_WINDOW_MS } from "../../src/lib/notes/schema";
import { purgeExpiredNotes, softDeleteNote } from "../../src/lib/notes/store";
import { withNotesSchema } from "./fixture.test";

const noteBody = z.object({
  id: z.uuid(),
  title: z.string(),
  body: z.string(),
  deletedAt: z.string().nullable(),
}).passthrough();
const noteResponse = z.object({ note: noteBody });
const noteList = z.object({ notes: z.array(z.object({ id: z.uuid() }).passthrough()) });

let ctx: Awaited<ReturnType<typeof withNotesSchema>>;
let cookie: string;
before(async () => {
  ctx = await withNotesSchema("notes_routes_test");
});
beforeEach(async () => {
  await ctx.database`TRUNCATE notes, sessions CASCADE`;
  const session = await createSession();
  cookie = `brain_session=${session.token}`;
});
after(async () => { await ctx.close(); });

function context(id: string) {
  return { params: Promise.resolve({ id }) };
}

function jsonRequest(path: string, method: string, body?: unknown, withCookie = true) {
  return new Request(`http://127.0.0.1${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(withCookie ? { cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const calls = [
  { name: "GET /api/notes", run: (request: Request) => LIST(request) },
  { name: "POST /api/notes", run: (request: Request) => CREATE(request) },
  { name: "GET /api/notes/trash", run: (request: Request) => TRASH(request) },
  { name: "GET /api/notes/:id", run: (request: Request, id: string) => GET_ONE(request, context(id)) },
  { name: "PATCH /api/notes/:id", run: (request: Request, id: string) => PATCH(request, context(id)) },
  { name: "DELETE /api/notes/:id", run: (request: Request, id: string) => DELETE(request, context(id)) },
  { name: "POST /api/notes/:id/restore", run: (request: Request, id: string) => RESTORE(request, context(id)) },
] as const;

for (const forgedCookie of [undefined, "brain_session=forged-token"] as const) {
  for (const call of calls) {
    it(`returns 401 when ${call.name} has ${forgedCookie === undefined ? "no" : "a forged"} session`, async () => {
      // Given
      const id = randomUUID();
      const request = new Request(`http://127.0.0.1/api/notes/${id}`, {
        method: call.name.startsWith("GET") ? "GET" : call.name.startsWith("DELETE") ? "DELETE" : call.name.startsWith("PATCH") ? "PATCH" : "POST",
        headers: forgedCookie === undefined ? {} : { cookie: forgedCookie },
      });
      // When
      const response = await call.run(request, id);
      // Then
      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { error: "unauthorized" });
    });
  }
}

it("creates a note and returns 201 with the created note", async () => {
  // Given / When
  const response = await CREATE(jsonRequest("/api/notes", "POST", { title: "Hello", body: "World" }));
  // Then
  assert.equal(response.status, 201);
  const payload = noteResponse.parse(await response.json());
  assert.equal(payload.note.title, "Hello");
  assert.equal(payload.note.body, "World");
  assert.equal(payload.note.deletedAt, null);
});

it("lists active notes but excludes a soft-deleted one", async () => {
  // Given
  const kept = noteResponse.parse(await (await CREATE(jsonRequest("/api/notes", "POST", { title: "Kept", body: "B" }))).json());
  const removed = noteResponse.parse(await (await CREATE(jsonRequest("/api/notes", "POST", { title: "Removed", body: "B" }))).json());
  await DELETE(jsonRequest(`/api/notes/${removed.note.id}`, "DELETE"), context(removed.note.id));
  // When
  const response = await LIST(jsonRequest("/api/notes", "GET"));
  // Then
  assert.equal(response.status, 200);
  const payload = noteList.parse(await response.json());
  assert.deepEqual(payload.notes.map((note) => note.id), [kept.note.id]);
});

it("returns the note by id when it is active", async () => {
  // Given
  const created = noteResponse.parse(await (await CREATE(jsonRequest("/api/notes", "POST", { title: "A", body: "B" }))).json());
  // When
  const response = await GET_ONE(jsonRequest(`/api/notes/${created.note.id}`, "GET"), context(created.note.id));
  // Then
  assert.equal(response.status, 200);
  assert.equal(noteResponse.parse(await response.json()).note.id, created.note.id);
});

it("returns 404 when the note id does not exist", async () => {
  // Given / When
  const id = randomUUID();
  const response = await GET_ONE(jsonRequest(`/api/notes/${id}`, "GET"), context(id));
  // Then
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "not_found" });
});

it("returns 404 when the note was purged", async () => {
  // Given
  const created = noteResponse.parse(await (await CREATE(jsonRequest("/api/notes", "POST", { title: "A", body: "B" }))).json());
  const id = parseNoteId(created.note.id);
  assert.ok(id);
  await softDeleteNote(id, new Date(Date.now() - RESTORE_WINDOW_MS - 1_000));
  await purgeExpiredNotes(new Date());
  // When
  const response = await GET_ONE(jsonRequest(`/api/notes/${created.note.id}`, "GET"), context(created.note.id));
  // Then
  assert.equal(response.status, 404);
});

it("updates title and body via PATCH", async () => {
  // Given
  const created = noteResponse.parse(await (await CREATE(jsonRequest("/api/notes", "POST", { title: "Old", body: "Old body" }))).json());
  // When
  const response = await PATCH(jsonRequest(`/api/notes/${created.note.id}`, "PATCH", { title: "New", body: "New body" }), context(created.note.id));
  // Then
  assert.equal(response.status, 200);
  const payload = noteResponse.parse(await response.json());
  assert.equal(payload.note.title, "New");
  assert.equal(payload.note.body, "New body");
});

it("returns 404 patching a note that does not exist", async () => {
  // Given / When
  const id = randomUUID();
  const response = await PATCH(jsonRequest(`/api/notes/${id}`, "PATCH", { title: "New", body: "New body" }), context(id));
  // Then
  assert.equal(response.status, 404);
});

it("soft deletes a note and returns 204", async () => {
  // Given
  const created = noteResponse.parse(await (await CREATE(jsonRequest("/api/notes", "POST", { title: "A", body: "B" }))).json());
  // When
  const response = await DELETE(jsonRequest(`/api/notes/${created.note.id}`, "DELETE"), context(created.note.id));
  // Then
  assert.equal(response.status, 204);
  assert.equal(await response.text(), "");
  const [row] = await ctx.database<{ readonly deleted_at: Date | null }[]>`SELECT deleted_at FROM notes WHERE id = ${created.note.id}`;
  assert.ok(row?.deleted_at instanceof Date);
});

it("returns 404 deleting a note that does not exist", async () => {
  // Given / When
  const id = randomUUID();
  const response = await DELETE(jsonRequest(`/api/notes/${id}`, "DELETE"), context(id));
  // Then
  assert.equal(response.status, 404);
});

it("lists a soft-deleted note in trash while it is within the 7 day window", async () => {
  // Given
  const created = noteResponse.parse(await (await CREATE(jsonRequest("/api/notes", "POST", { title: "A", body: "B" }))).json());
  await DELETE(jsonRequest(`/api/notes/${created.note.id}`, "DELETE"), context(created.note.id));
  // When
  const response = await TRASH(jsonRequest("/api/notes/trash", "GET"));
  // Then
  assert.equal(response.status, 200);
  const payload = noteList.parse(await response.json());
  assert.deepEqual(payload.notes.map((note) => note.id), [created.note.id]);
});

it("restores a note deleted within the 7 day window and returns it", async () => {
  // Given
  const created = noteResponse.parse(await (await CREATE(jsonRequest("/api/notes", "POST", { title: "A", body: "B" }))).json());
  await DELETE(jsonRequest(`/api/notes/${created.note.id}`, "DELETE"), context(created.note.id));
  // When
  const response = await RESTORE(jsonRequest(`/api/notes/${created.note.id}/restore`, "POST"), context(created.note.id));
  // Then
  assert.equal(response.status, 200);
  const payload = noteResponse.parse(await response.json());
  assert.equal(payload.note.id, created.note.id);
  assert.equal(payload.note.deletedAt, null);
});

it("returns 410 restoring a note deleted more than 7 days ago", async () => {
  // Given
  const created = noteResponse.parse(await (await CREATE(jsonRequest("/api/notes", "POST", { title: "A", body: "B" }))).json());
  const id = parseNoteId(created.note.id);
  assert.ok(id);
  const deletedAt = new Date(Date.now() - RESTORE_WINDOW_MS - 1_000);
  await softDeleteNote(id, deletedAt);
  // When
  const response = await RESTORE(jsonRequest(`/api/notes/${created.note.id}/restore`, "POST"), context(created.note.id));
  // Then
  assert.equal(response.status, 410);
  assert.deepEqual(await response.json(), { error: "expired" });
  const [row] = await ctx.database<{ readonly deleted_at: Date }[]>`SELECT deleted_at FROM notes WHERE id = ${created.note.id}`;
  assert.equal(row?.deleted_at.getTime(), deletedAt.getTime());
});

it("returns 404 restoring a note id that never existed", async () => {
  // Given / When
  const id = randomUUID();
  const response = await RESTORE(jsonRequest(`/api/notes/${id}/restore`, "POST"), context(id));
  // Then
  assert.equal(response.status, 404);
});
