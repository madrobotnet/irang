import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { closeDb, connectTestDatabase, resetData } from "@/server/test/db";
import { contentDisposition, loadAttachment, MAX_ATTACHMENT_BYTES, saveAttachment } from "./attachments";
import { createNote } from "./service";

connectTestDatabase();
const directory = await mkdtemp(path.join(os.tmpdir(), "sb-attachments-"));
process.env.ATTACHMENTS_DIR = directory;
beforeEach(resetData);
afterAll(async () => {
  await closeDb();
  await rm(directory, { recursive: true, force: true });
});

describe("attachments", () => {
  test("stores bytes under a randomized key and loads their safe metadata", async () => {
    const note = await createNote({ title: "첨부 노트" });
    const saved = await saveAttachment(new File(["hello"], "../한글\r\n.txt", { type: "text/plain" }), note.id);
    const loaded = await loadAttachment(saved.id);

    expect(saved.storageKey).toMatch(/^[0-9a-f-]{36}$/);
    expect(saved.storageKey).not.toContain("txt");
    expect(saved.filename).toBe("한글.txt");
    expect(new TextDecoder().decode(loaded.bytes)).toBe("hello");
    expect(contentDisposition(saved.filename)).not.toContain("\r");
    expect(contentDisposition(saved.filename)).toContain("filename*=UTF-8''");
  });

  test("rejects files larger than 25MB before writing", async () => {
    const oversized = new File([new Uint8Array(MAX_ATTACHMENT_BYTES + 1)], "large.bin");
    await expect(saveAttachment(oversized)).rejects.toMatchObject({ code: "payload_too_large" });
  });

  test("rejects traversal identifiers and missing note owners", async () => {
    await expect(loadAttachment("../../etc/passwd")).rejects.toMatchObject({ code: "validation" });
    await expect(saveAttachment(new File(["x"], "x.txt"), crypto.randomUUID())).rejects.toMatchObject({ code: "not_found" });
  });
});
