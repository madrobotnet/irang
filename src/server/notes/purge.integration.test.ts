import { afterAll, afterEach, beforeEach, expect, spyOn, test } from "bun:test";
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
    expect(await query("SELECT storage_key FROM attachment_cleanup")).toEqual([]);
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

test("a committed purge succeeds and failed file cleanup survives a process restart", async () => {
  const failed = await noteWithFile();
  const next = await noteWithFile();
  await trashNote(failed.note.id);
  await trashNote(next.note.id);
  await rm(failed.file);
  await mkdir(failed.file);
  await writeFile(path.join(failed.file, "blocker"), "filesystem failure fixture");
  const warning = spyOn(console, "warn").mockImplementation(() => undefined);
  try {
    await expect(purgeNote(failed.note.id)).resolves.toBeUndefined();

    expect(await getNote(failed.note.id)).toBeNull();
    expect(warning).toHaveBeenCalled();
    expect(JSON.stringify(warning.mock.calls)).not.toContain(failed.file);
    expect(JSON.stringify(warning.mock.calls)).not.toContain(path.basename(failed.file));
    await closeDb();
    await rm(failed.file, { recursive: true });
    await writeFile(failed.file, "retry after filesystem recovery");
    const child = Bun.spawn([
      process.execPath, "--no-env-file", "-e",
      `import { purgeNote } from "./src/server/notes/service.ts";
       import { closeDb } from "./src/server/db/index.ts";
       const id = process.env.PURGE_NOTE_ID;
       if (!id) throw new Error("Missing fixture note");
       try { await purgeNote(id); } finally { await closeDb(); }`,
    ], {
      cwd: path.resolve(import.meta.dir, "../../.."),
      env: { ...process.env, PURGE_NOTE_ID: next.note.id },
      stdout: "ignore",
      stderr: "pipe",
    });
    const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
    expect(stderr).toBe("");
    expect(exitCode).toBe(0);
    await expect(readFile(failed.file)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(next.file)).rejects.toMatchObject({ code: "ENOENT" });
  } finally {
    warning.mockRestore();
  }
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

test("a failed cleanup key does not starve later batches of removable files", async () => {
  const note = await createNote({ title: "Cleanup batches" });
  const keys = Array.from({ length: 35 }, (_, index) =>
    `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`);
  const blocked = keys[0];
  if (!blocked) throw new Error("Missing blocked fixture key");
  for (const key of keys) {
    const file = path.join(directory, "attachments", key);
    if (key === blocked) {
      await mkdir(file);
      await writeFile(path.join(file, "blocker"), "keep this directory");
    } else {
      await writeFile(file, "removable");
    }
  }
  await query(
    `INSERT INTO attachments (note_id,filename,mime,size_bytes,storage_key)
     SELECT $1,'fixture.txt','text/plain',9,key FROM unnest($2::text[]) AS key`,
    [note.id, keys],
  );
  await trashNote(note.id);
  const warning = spyOn(console, "warn").mockImplementation(() => undefined);
  try {
    await purgeNote(note.id);

    for (const key of keys.slice(1)) {
      await expect(readFile(path.join(directory, "attachments", key))).rejects.toMatchObject({ code: "ENOENT" });
    }
    expect(await query("SELECT storage_key FROM attachment_cleanup")).toEqual([{ storage_key: blocked }]);
    expect(await readFile(path.join(directory, "attachments", blocked, "blocker"), "utf8")).toBe("keep this directory");
  } finally {
    warning.mockRestore();
  }
});
