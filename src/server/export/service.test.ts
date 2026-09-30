import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { strFromU8, unzipSync } from "fflate";
import { query } from "@/server/db";
import { saveAttachment } from "@/server/notes/attachments";
import { storagePath } from "@/server/notes/attachment-storage";
import { createNote, getOrCreateDaily, trashNote, updateNote } from "@/server/notes/service";
import { closeDb, connectTestDatabase, resetData } from "@/server/test/db";
import { exportResponse } from "./service";

connectTestDatabase();
const directory = await mkdtemp(path.join(os.tmpdir(), "sb-export-"));
process.env.ATTACHMENTS_DIR = directory;
beforeEach(resetData);
afterAll(async () => {
  await closeDb();
  await rm(directory, { recursive: true, force: true });
});

async function unzip(response: Response): Promise<Record<string, Uint8Array>> {
  return unzipSync(new Uint8Array(await response.arrayBuffer()));
}
function frontMatterOf(markdown: string): unknown {
  return Bun.YAML.parse(markdown.slice(4, markdown.indexOf("\n---\n")));
}

describe("markdown export", () => {
  test("zips active and archived notes with front matter and their attachments, skipping trash", async () => {
    const first = await createNote({ title: "회의", tags: ["work"] });
    const image = await saveAttachment(new File(["PNG-BYTES"], "diagram.png", { type: "image/png" }), first.id);
    const lost = await saveAttachment(new File(["gone"], "lost.txt", { type: "text/plain" }), first.id);
    await unlink(storagePath(lost.storageKey));
    const body = `![diagram](/api/attachments/${image.id})\n[[회의|같은 제목]] [lost](/api/attachments/${lost.id})`;
    await updateNote(first.id, { body });
    const second = await createNote({ title: "회의", body: "보관한 노트" });
    await updateNote(second.id, { archived: true });
    await createNote({ title: "A/B: test?" });
    await getOrCreateDaily("2026-09-30");
    const trashed = await createNote({ title: "버린 노트" });
    await saveAttachment(new File(["secret"], "trash.png", { type: "image/png" }), trashed.id);
    await trashNote(trashed.id);
    await saveAttachment(new File(["loose"], "unreferenced.png", { type: "image/png" }));

    const response = await exportResponse(new Date("2026-09-30T23:59:00.000Z"));
    expect(response.headers.get("content-type")).toBe("application/zip");
    expect(response.headers.get("content-disposition")).toBe("attachment; filename=irang-export-2026-09-30.zip");
    expect(response.headers.get("cache-control")).toBe("no-store");
    const entries = await unzip(response);

    expect(Object.keys(entries).sort()).toEqual([
      "attachments/diagram.png", "notes/2026-09-30.md", "notes/A-B- test-.md", "notes/회의-2.md", "notes/회의.md",
    ]);
    expect(strFromU8(entries["attachments/diagram.png"]!)).toBe("PNG-BYTES");
    const markdown = strFromU8(entries["notes/회의.md"]!);
    expect(markdown.slice(markdown.indexOf("\n---\n") + 5)).toBe(
      `![diagram](../attachments/diagram.png)\n[[회의|같은 제목]] [lost](/api/attachments/${lost.id})`,
    );
    expect(frontMatterOf(markdown)).toMatchObject({ id: first.id, title: "회의", tags: ["work"], archived: false });
    expect(frontMatterOf(strFromU8(entries["notes/회의-2.md"]!))).toMatchObject({ id: second.id, archived: true });
    expect(frontMatterOf(strFromU8(entries["notes/2026-09-30.md"]!))).toMatchObject({ daily_date: "2026-09-30" });
  });

  test("pages through notes that share one creation time without skipping or repeating any", async () => {
    await query("INSERT INTO notes (title,body) SELECT 'note ' || g, '' FROM generate_series(1,250) g");
    const names = Object.keys(await unzip(await exportResponse()));
    expect(names).toHaveLength(250);
    expect(new Set(names).size).toBe(250);
  });

  test("produces a valid empty archive when there are no notes", async () => {
    expect(await unzip(await exportResponse())).toEqual({});
  });
});
