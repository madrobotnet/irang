import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, it } from "node:test";
import {
  createNote,
  getActiveNote,
  listActiveNotes,
  listTrash,
  purgeExpiredNotes,
  restoreNote,
  softDeleteNote,
  updateNote,
} from "../../src/lib/notes/store";
import { parseNoteId, RESTORE_WINDOW_MS } from "../../src/lib/notes/schema";
import { withNotesSchema } from "./fixture.test";

let ctx: Awaited<ReturnType<typeof withNotesSchema>>;
before(async () => { ctx = await withNotesSchema("notes_store_test"); });
beforeEach(async () => { await ctx.database`TRUNCATE notes CASCADE`; });
after(async () => { await ctx.close(); });

const now = new Date("2030-01-01T00:00:00Z");

function randomNoteId() {
  const id = parseNoteId(randomUUID());
  assert.ok(id);
  return id;
}

it("creates a note with the given title and body when created", async () => {
  // Given / When
  const note = await createNote({ title: "Hello", body: "World" }, now);
  // Then
  assert.equal(note.title, "Hello");
  assert.equal(note.body, "World");
  assert.equal(note.deletedAt, null);
  assert.deepEqual(note.createdAt, now);
  assert.deepEqual(note.updatedAt, now);
});

it("returns the active note when it exists and is not deleted", async () => {
  // Given
  const created = await createNote({ title: "A", body: "B" }, now);
  // When
  const found = await getActiveNote(created.id);
  // Then
  assert.deepEqual(found, created);
});

it("returns null when the note id does not exist", async () => {
  // Given / When
  const found = await getActiveNote(randomNoteId());
  // Then
  assert.equal(found, null);
});

it("returns null for a soft-deleted note when fetched as active", async () => {
  // Given
  const created = await createNote({ title: "A", body: "B" }, now);
  await softDeleteNote(created.id, now);
  // When
  const found = await getActiveNote(created.id);
  // Then
  assert.equal(found, null);
});

it("lists only active notes when a deleted note also exists", async () => {
  // Given
  const active = await createNote({ title: "Active", body: "B" }, now);
  const deleted = await createNote({ title: "Deleted", body: "B" }, now);
  await softDeleteNote(deleted.id, now);
  // When
  const notes = await listActiveNotes();
  // Then
  assert.deepEqual(notes.map((note) => note.id), [active.id]);
});

it("updates title and body when the note is active", async () => {
  // Given
  const created = await createNote({ title: "Old", body: "Old body" }, now);
  const later = new Date(now.getTime() + 1000);
  // When
  const updated = await updateNote(created.id, { title: "New", body: "New body" }, later);
  // Then
  assert.ok(updated);
  assert.equal(updated.title, "New");
  assert.equal(updated.body, "New body");
  assert.deepEqual(updated.updatedAt, later);
});

it("returns null updating a note that was soft-deleted", async () => {
  // Given
  const created = await createNote({ title: "Old", body: "Old body" }, now);
  await softDeleteNote(created.id, now);
  // When
  const updated = await updateNote(created.id, { title: "New", body: "New body" }, now);
  // Then
  assert.equal(updated, null);
});

it("soft deletes an active note and hides it from the active list", async () => {
  // Given
  const created = await createNote({ title: "A", body: "B" }, now);
  // When
  const deleted = await softDeleteNote(created.id, now);
  // Then
  assert.equal(deleted, true);
  assert.equal(await getActiveNote(created.id), null);
});

it("returns false when soft-deleting a note that is already deleted", async () => {
  // Given
  const created = await createNote({ title: "A", body: "B" }, now);
  await softDeleteNote(created.id, now);
  // When
  const secondDelete = await softDeleteNote(created.id, now);
  // Then
  assert.equal(secondDelete, false);
});

it("restores a note when it was deleted exactly at the 7 day boundary", async () => {
  // Given
  const created = await createNote({ title: "A", body: "B" }, now);
  await softDeleteNote(created.id, new Date(now.getTime() - RESTORE_WINDOW_MS));
  // When
  const result = await restoreNote(created.id, now);
  // Then
  assert.equal(result.kind, "restored");
});

it("clears deleted_at and returns the note when restored within the window", async () => {
  // Given
  const created = await createNote({ title: "A", body: "B" }, now);
  await softDeleteNote(created.id, new Date(now.getTime() - 1000));
  // When
  const result = await restoreNote(created.id, now);
  // Then
  assert.ok(result.kind === "restored");
  assert.equal(result.note.deletedAt, null);
  assert.deepEqual(await getActiveNote(created.id), result.note);
});

it("reports expired when the note was deleted just past the 7 day window", async () => {
  // Given
  const created = await createNote({ title: "A", body: "B" }, now);
  await softDeleteNote(created.id, new Date(now.getTime() - RESTORE_WINDOW_MS - 1));
  // When
  const result = await restoreNote(created.id, now);
  // Then
  assert.deepEqual(result, { kind: "expired" });
});

it("reports not_found restoring a note that is not deleted", async () => {
  // Given
  const created = await createNote({ title: "A", body: "B" }, now);
  // When
  const result = await restoreNote(created.id, now);
  // Then
  assert.deepEqual(result, { kind: "not_found" });
});

it("reports not_found restoring an id that never existed", async () => {
  // Given / When
  const result = await restoreNote(randomNoteId(), now);
  // Then
  assert.deepEqual(result, { kind: "not_found" });
});

it("lists trash with only notes deleted within the 7 day window", async () => {
  // Given
  const recent = await createNote({ title: "Recent", body: "B" }, now);
  await softDeleteNote(recent.id, new Date(now.getTime() - 1000));
  const old = await createNote({ title: "Old", body: "B" }, now);
  await softDeleteNote(old.id, new Date(now.getTime() - RESTORE_WINDOW_MS - 1));
  const active = await createNote({ title: "Active", body: "B" }, now);
  // When
  const trash = await listTrash(now);
  // Then
  assert.deepEqual(trash.map((note) => note.id).sort(), [recent.id].sort());
  assert.equal(trash.some((note) => note.id === active.id), false);
  assert.equal(trash.some((note) => note.id === old.id), false);
});

it("purges only notes deleted strictly more than 7 days before the injected now", async () => {
  // Given
  const expired = await createNote({ title: "Expired", body: "B" }, now);
  await softDeleteNote(expired.id, new Date(now.getTime() - RESTORE_WINDOW_MS - 1));
  const boundary = await createNote({ title: "Boundary", body: "B" }, now);
  await softDeleteNote(boundary.id, new Date(now.getTime() - RESTORE_WINDOW_MS));
  const recent = await createNote({ title: "Recent", body: "B" }, now);
  await softDeleteNote(recent.id, new Date(now.getTime() - 1000));
  // When
  const purgedCount = await purgeExpiredNotes(now);
  // Then
  assert.equal(purgedCount, 1);
  const remaining = await ctx.database<{ readonly id: string }[]>`SELECT id FROM notes ORDER BY id`;
  assert.deepEqual(remaining.map((row) => row.id).sort(), [boundary.id, recent.id].sort());
});

it("removes an attachment when its note is purged", async () => {
  // Given
  const expired = await createNote({ title: "Expired", body: "B" }, now);
  await softDeleteNote(expired.id, new Date(now.getTime() - RESTORE_WINDOW_MS - 1));
  await ctx.database`
    INSERT INTO attachments (id, note_id, filename, mime, byte_size, storage_key, created_at)
    VALUES (${randomUUID()}, ${expired.id}, 'a.txt', 'text/plain', 1, 'k', ${now})
  `;
  // When
  const purgedCount = await purgeExpiredNotes(now);
  // Then
  assert.equal(purgedCount, 1);
  assert.equal((await ctx.database`SELECT id FROM attachments WHERE note_id = ${expired.id}`).length, 0);
});

it("purges nothing when every deleted note is within the 7 day window", async () => {
  // Given
  const created = await createNote({ title: "A", body: "B" }, now);
  await softDeleteNote(created.id, new Date(now.getTime() - 1000));
  // When
  const purgedCount = await purgeExpiredNotes(now);
  // Then
  assert.equal(purgedCount, 0);
});
