import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { mkdir, open, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { QueryResultRow } from "pg";
import { db } from "@/server/db";
import { ApiError } from "@/server/http";
import { assertNoteId } from "./service";
import { attachmentsDir, storagePath } from "./attachment-storage";

export { attachmentsDir } from "./attachment-storage";

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

type AttachmentRow = QueryResultRow & {
  id: string;
  note_id: string | null;
  filename: string;
  mime: string;
  size_bytes: string | number;
  storage_key: string;
};
export type Attachment = {
  id: string;
  noteId: string | null;
  filename: string;
  mime: string;
  sizeBytes: number;
  storageKey: string;
};

function safeFilename(filename: string): string {
  const cleaned = path.basename(filename).replace(/[\r\n\0]/g, "").trim();
  return cleaned.slice(0, 255) || "attachment";
}

function safeMime(mime: string): string {
  return /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i.test(mime) ? mime.toLowerCase() : "application/octet-stream";
}

function mapAttachment(row: AttachmentRow): Attachment {
  return {
    id: row.id,
    noteId: row.note_id,
    filename: row.filename,
    mime: row.mime,
    sizeBytes: Number(row.size_bytes),
    storageKey: row.storage_key,
  };
}

export async function saveAttachment(file: File, noteId?: string): Promise<Attachment> {
  if (file.size > MAX_ATTACHMENT_BYTES) throw new ApiError("payload_too_large", "첨부 파일은 25MB 이하여야 합니다.");
  if (file.size === 0) throw new ApiError("validation", "빈 파일은 첨부할 수 없습니다.");
  if (noteId) assertNoteId(noteId);
  const pool = await db();
  if (noteId) {
    const note = await pool.query("SELECT id FROM notes WHERE id=$1 AND deleted_at IS NULL", [noteId]);
    if (note.rowCount === 0) throw new ApiError("not_found", "노트를 찾을 수 없습니다.");
  }
  const key = randomUUID();
  const filename = safeFilename(file.name);
  const mime = safeMime(file.type);
  await mkdir(attachmentsDir(), { recursive: true });
  await writeFile(storagePath(key), new Uint8Array(await file.arrayBuffer()), { flag: "wx" });
  try {
    const result = await pool.query<AttachmentRow>(
      "INSERT INTO attachments (note_id,filename,mime,size_bytes,storage_key) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [noteId ?? null, filename, mime, file.size, key],
    );
    return mapAttachment(result.rows[0]!);
  } catch (error) {
    await unlink(storagePath(key)).catch(() => undefined);
    throw error;
  }
}

export async function loadAttachment(id: string): Promise<{ attachment: Attachment; bytes: Uint8Array }> {
  assertNoteId(id);
  const pool = await db();
  const result = await pool.query<AttachmentRow>("SELECT * FROM attachments WHERE id=$1", [id]);
  const row = result.rows[0];
  if (!row) throw new ApiError("not_found", "첨부 파일을 찾을 수 없습니다.");
  try {
    const file = await open(storagePath(row.storage_key), constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      return { attachment: mapAttachment(row), bytes: await file.readFile() };
    } finally {
      await file.close();
    }
  } catch (error) {
    if (error instanceof Error && "code" in error && (error.code === "ENOENT" || error.code === "ELOOP")) {
      throw new ApiError("not_found", "첨부 파일을 찾을 수 없습니다.");
    }
    throw error;
  }
}

export function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
