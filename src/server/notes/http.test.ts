import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { MemoryNotesStore } from "./memory-store";
import { setNotesStoreForTests, resetNotesRuntimeForTests } from "./runtime";
import {
  handleCapture,
  handleCaptureShare,
  handleCreateNote,
  handleDeleteAttachment,
  handleDeleteNote,
  handleGetAttachment,
  handleGetNote,
  handleListNotes,
  handlePatchNote,
  handleRestoreNote,
  handleUploadAttachment,
} from "./http";

let attachDir = "";

beforeEach(async () => {
  attachDir = await mkdtemp(path.join(os.tmpdir(), "sb-attach-"));
  process.env.ATTACHMENTS_DIR = attachDir;
  setNotesStoreForTests(new MemoryNotesStore());
});

afterEach(async () => {
  resetNotesRuntimeForTests();
  if (attachDir) {
    await rm(attachDir, { recursive: true, force: true });
  }
  delete process.env.ATTACHMENTS_DIR;
  delete process.env.URL_SUMMARY_FORCE_FAIL;
});

describe("notes API (API_NOTE_CONTRACT)", () => {
  it("creates and lists notes", async () => {
    const create = await handleCreateNote(
      new Request("http://localhost/api/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "T", body: "B" }),
      }),
    );
    expect(create.status).toBe(201);
    const created = (await create.json()) as { ok: true; note: { id: string } };
    const list = await handleListNotes(new Request("http://localhost/api/notes"));
    expect(list.status).toBe(200);
    const body = (await list.json()) as { notes: { id: string }[] };
    expect(body.notes.some((n) => n.id === created.note.id)).toBe(true);
  });

  it("rejects empty title/body", async () => {
    const res = await handleCreateNote(
      new Request("http://localhost/api/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: " ", body: "" }),
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ ok: false, code: "validation" });
  });

  it("soft delete, restore, and purge", async () => {
    const create = await handleCreateNote(
      new Request("http://localhost/api/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Del", body: "x" }),
      }),
    );
    const { note } = (await create.json()) as { note: { id: string } };
    const del = await handleDeleteNote(note.id);
    expect(del.status).toBe(200);
    const deleted = (await del.json()) as { note: { deletedAt: string; purgeAt: string } };
    expect(deleted.note.deletedAt).toBeTruthy();
    expect(deleted.note.purgeAt).toBeTruthy();

    const patch = await handlePatchNote(
      note.id,
      new Request("http://localhost", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Nope" }),
      }),
    );
    expect(patch.status).toBe(409);

    const restore = await handleRestoreNote(note.id);
    expect(restore.status).toBe(200);

    const purgeStore = new MemoryNotesStore();
    setNotesStoreForTests(purgeStore);
    const doomed = await purgeStore.createNote({ title: "x", body: "y", status: "draft" });
    const deletedAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    const purgeAt = new Date(Date.now() - 1000);
    await purgeStore.softDeleteNote(doomed.id, deletedAt, purgeAt);
    const purged = await handleRestoreNote(doomed.id);
    expect(purged.status).toBe(410);

    const gone = await handleGetNote(doomed.id);
    expect(gone.status).toBe(404);
  });

  it("capture to inbox and note without url", async () => {
    const inbox = await handleCapture(
      new Request("http://localhost/api/capture", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Cap", body: "Body", target: "inbox" }),
      }),
    );
    expect(inbox.status).toBe(201);
    const note = await handleCapture(
      new Request("http://localhost/api/capture", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Cap2", body: "Body2", target: "note" }),
      }),
    );
    expect(note.status).toBe(201);
  });

  it("capture url failure records ingest job", async () => {
    process.env.URL_SUMMARY_FORCE_FAIL = "1";
    const res = await handleCapture(
      new Request("http://localhost/api/capture", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "U",
          body: "ignored",
          target: "note",
          url: "https://example.com/article",
        }),
      }),
    );
    expect(res.status).toBe(502);
    const body = (await res.json()) as { code: string; jobId?: string };
    expect(body.code).toBe("ingest_failed");
    expect(body.jobId).toBeTruthy();
  });

  it("share capture creates inbox item", async () => {
    const res = await handleCaptureShare(
      new Request("http://localhost/api/capture/share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: "hello share" }),
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { inboxItem: { source: string } };
    expect(body.inboxItem.source).toBe("share");
  });

  it("attachment upload whitelist and size", async () => {
    const noteRes = await handleCreateNote(
      new Request("http://localhost/api/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Att", body: "b" }),
      }),
    );
    const { note } = (await noteRes.json()) as { note: { id: string } };
    const bad = await handleUploadAttachment(
      new Request("http://localhost/api/attachments", {
        method: "POST",
        body: (() => {
          const fd = new FormData();
          fd.set("noteId", note.id);
          fd.set("file", new File(["x"], "evil.exe", { type: "application/octet-stream" }));
          return fd;
        })(),
      }),
    );
    expect(bad.status).toBe(415);

    const ok = await handleUploadAttachment(
      new Request("http://localhost/api/attachments", {
        method: "POST",
        body: (() => {
          const fd = new FormData();
          fd.set("noteId", note.id);
          fd.set("file", new File(["# hi"], "readme.md", { type: "text/markdown" }));
          return fd;
        })(),
      }),
    );
    expect(ok.status).toBe(201);
    const { attachment } = (await ok.json()) as { attachment: { id: string } };
    const dl = await handleGetAttachment(attachment.id);
    expect(dl.status).toBe(200);
    const del = await handleDeleteAttachment(attachment.id);
    expect(del.status).toBe(200);
  });
});
