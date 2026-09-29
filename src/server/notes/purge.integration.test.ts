import { afterAll, afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { query } from "@/server/db";
import { closeDb, connectTestDatabase, resetData } from "@/server/test/db";
import { saveAttachment } from "./attachments";
import { createNote, getNote, purgeNote, trashNote } from "./service";

connectTestDatabase();
const originalDirectory = process.env.ATTACHMENTS_DIR;
let directory: string;
beforeEach(async () => {
  await resetData();
  directory = await mkdtemp(path.join(tmpdir(), "sb-purge-"));
  process.env.ATTACHMENTS_DIR = path.join(directory, "attachments");
  await mkdir(process.env.ATTACHMENTS_DIR);
});
afterEach(async () => {
  if (originalDirectory === undefined) delete process.env.ATTACHMENTS_DIR;
  else process.env.ATTACHMENTS_DIR = originalDirectory;
  await rm(directory, { recursive: true, force: true });
});
afterAll(closeDb);

async function noteWithFile() {
  const note = await createNote({ title: "Purge fixture" });
  const attachment = await saveAttachment(new File(["keep until purge"], "fixture.txt"), note.id);
  return { note, file: path.join(directory, "attachments", attachment.storageKey) };
}

test("permanent deletion removes current and legacy files belonging only to the trashed note", async () => {
  const selected = await noteWithFile();
  const retained = await noteWithFile();
  const unowned = await saveAttachment(new File(["unowned"], "unowned.txt"));
  const legacyKey = `${crypto.randomUUID()}-old-file.txt`;
  const legacyPath = path.join(directory, "attachments", legacyKey);
  await writeFile(legacyPath, "legacy");
  await query(
    "INSERT INTO attachments (note_id,filename,mime,size_bytes,storage_key) VALUES ($1,'old-file.txt','text/plain',6,$2)",
    [selected.note.id, legacyKey],
  );
  await trashNote(selected.note.id);

  await purgeNote(selected.note.id);

  expect(await getNote(selected.note.id)).toBeNull();
  await expect(readFile(selected.file)).rejects.toMatchObject({ code: "ENOENT" });
  await expect(readFile(legacyPath)).rejects.toMatchObject({ code: "ENOENT" });
  expect(await readFile(retained.file, "utf8")).toBe("keep until purge");
  expect(await readFile(path.join(directory, "attachments", unowned.storageKey), "utf8")).toBe("unowned");
});

test("moving a note to trash leaves its attachment bytes intact", async () => {
  const selected = await noteWithFile();

  await trashNote(selected.note.id);

  expect(await readFile(selected.file, "utf8")).toBe("keep until purge");
});

test("rejecting an active-note purge leaves its row and attachment intact", async () => {
  const selected = await noteWithFile();

  await expect(purgeNote(selected.note.id)).rejects.toMatchObject({ code: "conflict" });

  expect(await getNote(selected.note.id)).not.toBeNull();
  expect(await readFile(selected.file, "utf8")).toBe("keep until purge");
});

test("does not unlink files when the note transaction fails at commit", async () => {
  const selected = await noteWithFile();
  await trashNote(selected.note.id);
  const trigger = `purge_rollback_${crypto.randomUUID().replaceAll("-", "")}`;
  await query(`CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'fixture commit failure'; END $$`);
  try {
    await query(`CREATE CONSTRAINT TRIGGER ${trigger} AFTER DELETE ON notes
      DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ${trigger}()`);

    await expect(purgeNote(selected.note.id)).rejects.toMatchObject({ code: "P0001" });

    expect(await getNote(selected.note.id)).not.toBeNull();
    expect(await readFile(selected.file, "utf8")).toBe("keep until purge");
  } finally {
    await query(`DROP TRIGGER IF EXISTS ${trigger} ON notes`);
    await query(`DROP FUNCTION ${trigger}()`);
  }
});

test("a missing physical attachment does not block permanent deletion", async () => {
  const selected = await noteWithFile();
  await trashNote(selected.note.id);
  await rm(selected.file);

  await purgeNote(selected.note.id);

  expect(await getNote(selected.note.id)).toBeNull();
});

test("purging an attachment symlink removes the link but never its outside target", async () => {
  const note = await createNote({ title: "Symlink purge" });
  const key = `${crypto.randomUUID()}-outside.txt`;
  const outside = path.join(directory, "outside.txt");
  await writeFile(outside, "outside file");
  await symlink(outside, path.join(directory, "attachments", key));
  await query(
    "INSERT INTO attachments (note_id,filename,mime,size_bytes,storage_key) VALUES ($1,'outside.txt','text/plain',12,$2)",
    [note.id, key],
  );
  await trashNote(note.id);

  await purgeNote(note.id);

  await expect(readFile(path.join(directory, "attachments", key))).rejects.toMatchObject({ code: "ENOENT" });
  expect(await readFile(outside, "utf8")).toBe("outside file");
});
