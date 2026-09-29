import { afterAll, afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { query } from "@/server/db";
import { closeDb, connectTestDatabase, resetData } from "@/server/test/db";
import { loadAttachment } from "./attachments";

connectTestDatabase();
const originalDirectory = process.env.ATTACHMENTS_DIR;
let directory: string;

beforeEach(async () => {
  await resetData();
  directory = await mkdtemp(path.join(tmpdir(), "sb-attachment-compat-"));
  process.env.ATTACHMENTS_DIR = path.join(directory, "attachments");
  await mkdir(process.env.ATTACHMENTS_DIR);
});
afterEach(async () => {
  if (originalDirectory === undefined) delete process.env.ATTACHMENTS_DIR;
  else process.env.ATTACHMENTS_DIR = originalDirectory;
  await rm(directory, { recursive: true, force: true });
});
afterAll(closeDb);

async function storedAttachment(key: string, filename = "legacy.txt"): Promise<string> {
  const [row] = await query<{ id: string }>(
    `INSERT INTO attachments (filename,mime,size_bytes,storage_key)
     VALUES ($1,'text/plain',17,$2) RETURNING id`,
    [filename, key],
  );
  if (!row) throw new Error("Attachment fixture was not created");
  return row.id;
}

test.each(["report.txt", "한글 메모.pdf", "old\\report.txt"])("loads the unchanged v1 UUID-basename file %s", async (filename) => {
  const key = `${crypto.randomUUID()}-${filename}`;
  const id = await storedAttachment(key, filename);
  const bytes = new TextEncoder().encode("legacy attachment");
  await writeFile(path.join(directory, "attachments", key), bytes);

  const loaded = await loadAttachment(id);

  expect(loaded.bytes).toEqual(bytes);
  expect(loaded.attachment.filename).toBe(filename);
  expect(loaded.attachment.storageKey).toBe(key);
});

test.each([
  "../outside.txt",
  `${crypto.randomUUID()}-../outside.txt`,
  `${crypto.randomUUID()}-/outside.txt`,
  `${crypto.randomUUID()}-..\\outside.txt`,
  `${crypto.randomUUID()}-folder/outside.txt`,
])("rejects an attachment row with a path-containing storage key: %s", async (key) => {
  const id = await storedAttachment(key);
  await writeFile(path.join(directory, "outside.txt"), "private file");

  await expect(loadAttachment(id)).rejects.toMatchObject({ code: "not_found" });
});

test("does not follow a legacy attachment symlink outside its storage directory", async () => {
  const key = `${crypto.randomUUID()}-outside.txt`;
  const id = await storedAttachment(key);
  const outside = path.join(directory, "outside.txt");
  await writeFile(outside, "private file");
  await symlink(outside, path.join(directory, "attachments", key));

  await expect(loadAttachment(id)).rejects.toMatchObject({ code: "not_found" });
});
