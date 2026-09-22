import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryNotesStore } from "./memory-store";
import { setNotesStoreForTests, resetNotesRuntimeForTests } from "./runtime";
import { handleCreateNote, handleUploadAttachment } from "./http";
import * as validation from "./validation";

beforeEach(() => {
  setNotesStoreForTests(new MemoryNotesStore());
});

afterEach(() => {
  vi.restoreAllMocks();
  resetNotesRuntimeForTests();
});

describe("attachment upload size (API_NOTE_CONTRACT)", () => {
  it("returns 413 payload_too_large when size limit is exceeded", async () => {
    vi.spyOn(validation, "attachmentTooLarge").mockReturnValue(true);

    const noteRes = await handleCreateNote(
      new Request("http://localhost/api/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Att", body: "b" }),
      }),
    );
    const { note } = (await noteRes.json()) as { note: { id: string } };

    const file = new File([new Uint8Array(4)], "readme.md", { type: "text/markdown" });

    const res = await handleUploadAttachment(
      new Request("http://localhost/api/attachments", {
        method: "POST",
        body: (() => {
          const fd = new FormData();
          fd.set("noteId", note.id);
          fd.set("file", file);
          return fd;
        })(),
      }),
    );

    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ ok: false, code: "payload_too_large" });
  });
});
