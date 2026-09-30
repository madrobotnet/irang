import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { db, query } from "@/server/db";
import { closeDb, connectTestDatabase, resetData } from "@/server/test/db";
import { saveAttachment } from "./attachments";
import { createNote, getNote, listNotes, restoreNote, trashNote, updateNote } from "./service";
import { emptyTrash, purgeExpired } from "./trash";

connectTestDatabase();
const originalDirectory = process.env.ATTACHMENTS_DIR;
let directory: string;
beforeEach(async () => {
  await resetData();
  directory = await mkdtemp(path.join(tmpdir(), "sb-trash-"));
  process.env.ATTACHMENTS_DIR = path.join(directory, "attachments");
  await mkdir(process.env.ATTACHMENTS_DIR);
});
afterEach(async () => {
  if (originalDirectory === undefined) delete process.env.ATTACHMENTS_DIR;
  else process.env.ATTACHMENTS_DIR = originalDirectory;
  await rm(directory, { recursive: true, force: true });
});
afterAll(closeDb);

async function trashedWithFile(title: string) {
  const note = await createNote({ title });
  const attachment = await saveAttachment(new File(["bytes"], "fixture.txt"), note.id);
  await trashNote(note.id);
  return { id: note.id, file: path.join(directory, "attachments", attachment.storageKey) };
}
const expire = (id: string) => query("UPDATE notes SET purge_at=now() - interval '1 minute' WHERE id=$1", [id]);
const daysUntilPurge = async (id: string): Promise<number> => {
  const [row] = await query<{ days: number }>(
    "SELECT extract(epoch FROM purge_at - now())::float8 / 86400 AS days FROM notes WHERE id=$1", [id],
  );
  if (!row) throw new Error("Missing note fixture");
  return row.days;
};

describe("trash retention", () => {
  test("trashing schedules purge 30 days out and exposes it on detail and trash list", async () => {
    const note = await createNote({ title: "Retained" });

    const trashed = await trashNote(note.id);

    expect(await daysUntilPurge(note.id)).toBeGreaterThan(29.99);
    expect(await daysUntilPurge(note.id)).toBeLessThanOrEqual(30);
    expect(trashed.purgeAt).not.toBeNull();
    expect((await getNote(note.id))?.purgeAt).toBe(trashed.purgeAt);
    expect((await listNotes({ trash: true })).notes.map((item) => item.purgeAt)).toEqual([trashed.purgeAt]);
  });

  test("restoring clears the purge schedule", async () => {
    const note = await createNote({ title: "Restored" });
    await trashNote(note.id);

    const restored = await restoreNote(note.id);

    expect(restored.purgeAt).toBeNull();
    expect((await getNote(note.id))?.purgeAt).toBeNull();
  });

  test("purgeExpired removes only expired trash and its attachment files", async () => {
    const expired = await trashedWithFile("Expired");
    const waiting = await trashedWithFile("Still waiting");
    const active = await createNote({ title: "Active" });
    await expire(expired.id);

    expect(await purgeExpired(10)).toBe(1);

    expect(await getNote(expired.id)).toBeNull();
    await expect(readFile(expired.file)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await getNote(waiting.id)).not.toBeNull();
    expect(await readFile(waiting.file, "utf8")).toBe("bytes");
    expect(await getNote(active.id)).not.toBeNull();
    expect(await query("SELECT storage_key FROM attachment_cleanup")).toEqual([]);
  });

  test("purgeExpired honours its batch limit", async () => {
    for (const title of ["One", "Two", "Three"]) {
      const note = await createNote({ title });
      await trashNote(note.id);
      await expire(note.id);
    }

    expect(await purgeExpired(2)).toBe(2);

    expect((await listNotes({ trash: true })).notes).toHaveLength(1);
  });

  test("empty trash deletes every trashed note and nothing else", async () => {
    const first = await trashedWithFile("Trash one");
    const second = await trashedWithFile("Trash two");
    const active = await createNote({ title: "Kept active" });
    const archived = await createNote({ title: "Kept archived" });
    await updateNote(archived.id, { archived: true });

    expect(await emptyTrash()).toEqual({ purged: 2 });

    expect(await getNote(first.id)).toBeNull();
    expect(await getNote(second.id)).toBeNull();
    await expect(readFile(first.file)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await getNote(active.id)).not.toBeNull();
    expect(await getNote(archived.id)).not.toBeNull();
  });

  test("upgrading starts the clock for already-trashed notes instead of purging them", async () => {
    const legacy = await createNote({ title: "Trashed before retention existed" });
    await query("UPDATE notes SET deleted_at=now() - interval '90 days',purge_at=NULL WHERE id=$1", [legacy.id]);
    await query("DROP TABLE note_revisions");
    await query("DROP INDEX notes_trash_purge_idx");
    await query("DELETE FROM schema_migrations WHERE id='0007_note_revisions'");
    await closeDb();
    await db();

    expect(await purgeExpired(100)).toBe(0);

    expect(await getNote(legacy.id)).not.toBeNull();
    expect(await daysUntilPurge(legacy.id)).toBeGreaterThan(29.99);
  });
});
