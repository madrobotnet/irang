import { constants } from "node:fs";
import { lstat, open, type FileHandle } from "node:fs/promises";
import { crc32 } from "node:zlib";
import { strToU8, Zip, ZipDeflate, ZipPassThrough } from "fflate";
import type { Pool, QueryResultRow } from "pg";
import {
  attachmentHref, createNameAllocator, noteMarkdown, safeAttachmentName, safeFileName, type ExportNote,
} from "@/lib/export-format";
import { db } from "@/server/db";
import { ApiError } from "@/server/http";
import { storagePath } from "@/server/notes/attachment-storage";

const NOTE_BATCH = 100;
const READ_CHUNK_BYTES = 64 * 1024;
/** Zip bytes buffered ahead of a slow download before the writer pauses. */
const BUFFERED_BYTES = 1024 * 1024;

type NoteRow = QueryResultRow & {
  id: string; title: string; body: string; tags: string[]; aliases: string[]; pinned: boolean; status: string;
  source_url: string | null; daily_date: string | null; created_at: Date; updated_at: Date; cursor: string;
};
type AttachmentRow = QueryResultRow & { id: string; filename: string; storage_key: string; created_at: Date };
type PlannedAttachment = { readonly path: string; readonly storageKey: string; readonly mtime: Date };
type ExportPlan = { readonly attachments: readonly PlannedAttachment[]; readonly hrefs: ReadonlyMap<string, string> };
type Sink = { readonly cancelled: boolean; drained(): Promise<void> };

// Exported notes are every note outside the trash (active and archived); chat and inbox live elsewhere.
const NOTES_SQL = `
  SELECT id,title,body,tags,aliases,pinned,status,source_url,to_char(daily_date,'YYYY-MM-DD') AS daily_date,
    created_at,updated_at,to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor
  FROM notes WHERE deleted_at IS NULL
    AND ($1::timestamptz IS NULL OR (created_at,id) > ($1::timestamptz,$2::uuid))
  ORDER BY created_at,id LIMIT $3`;
// Attachments owned by an exported note or linked from one.
const ATTACHMENTS_SQL = `
  WITH exported AS (SELECT id,body FROM notes WHERE deleted_at IS NULL),
  linked AS (
    SELECT DISTINCT lower(m[1])::uuid AS id FROM exported,
      regexp_matches(exported.body,
        '/api/attachments/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})', 'g') AS m
  )
  SELECT a.id,a.filename,a.storage_key,a.created_at FROM attachments a
   WHERE a.note_id IN (SELECT id FROM exported) OR a.id IN (SELECT id FROM linked)
   ORDER BY a.created_at,a.id`;

export function exportFileName(now: Date): string {
  return `irang-export-${now.toISOString().slice(0, 10)}.zip`;
}

function isMissingFile(error: unknown): boolean {
  if (error instanceof ApiError) return error.code === "not_found"; // storagePath rejected the key
  return error instanceof Error && "code" in error && (error.code === "ENOENT" || error.code === "ELOOP");
}

/**
 * fflate sets the UTF-8 name flag, but Info-ZIP `unzip` on Linux only decodes non-ASCII names
 * from the Unicode Path extra field (0x7075: version 1, CRC-32 of the header name, UTF-8 name).
 */
function entry<T extends ZipDeflate | ZipPassThrough>(file: T, mtime: Date): T {
  file.mtime = mtime;
  const name = strToU8(file.filename);
  if (name.length !== file.filename.length) {
    const field = new Uint8Array(5 + name.length);
    field[0] = 1;
    new DataView(field.buffer).setUint32(1, crc32(name), true);
    field.set(name, 5);
    file.extra = { 0x7075: field };
  }
  return file;
}

async function planAttachments(pool: Pool): Promise<ExportPlan> {
  const rows = (await pool.query<AttachmentRow>(ATTACHMENTS_SQL)).rows;
  const allocate = createNameAllocator();
  const attachments: PlannedAttachment[] = [];
  const hrefs = new Map<string, string>();
  for (const row of rows) {
    try {
      if (!(await lstat(storagePath(row.storage_key))).isFile()) continue;
    } catch (error) {
      if (isMissingFile(error)) continue; // a missing file keeps its /api/attachments link
      throw error;
    }
    const { stem, extension } = safeAttachmentName(row.filename);
    const name = allocate(stem, extension);
    attachments.push({ path: `attachments/${name}`, storageKey: row.storage_key, mtime: row.created_at });
    hrefs.set(row.id, attachmentHref(name));
  }
  return { attachments, hrefs };
}

/** Keyset pages ordered by creation, so the oldest of two same-titled notes keeps the plain name. */
async function* exportedNotes(pool: Pool): AsyncGenerator<NoteRow> {
  let after: { at: string | null; id: string | null } = { at: null, id: null };
  for (;;) {
    const { rows } = await pool.query<NoteRow>(NOTES_SQL, [after.at, after.id, NOTE_BATCH]);
    yield* rows;
    const last = rows.at(-1);
    if (!last || rows.length < NOTE_BATCH) return;
    after = { at: last.cursor, id: last.id };
  }
}

function toExportNote(row: NoteRow): ExportNote {
  return {
    id: row.id, title: row.title, aliases: row.aliases, tags: row.tags, createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(), dailyDate: row.daily_date, sourceUrl: row.source_url,
    pinned: row.pinned, archived: row.status === "archived", body: row.body,
  };
}

async function writeAttachment(zip: Zip, sink: Sink, attachment: PlannedAttachment): Promise<void> {
  let handle: FileHandle;
  try {
    handle = await open(storagePath(attachment.storageKey), constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (error) {
    if (isMissingFile(error)) return; // the file can vanish between planning and writing (a purge mid-export)
    throw error;
  }
  try {
    const file = entry(new ZipPassThrough(attachment.path), attachment.mtime);
    zip.add(file);
    for (;;) {
      const chunk = new Uint8Array(READ_CHUNK_BYTES); // fresh buffer: the stream keeps each chunk
      const { bytesRead } = await handle.read(chunk, 0, READ_CHUNK_BYTES, null);
      file.push(chunk.subarray(0, bytesRead), bytesRead === 0);
      if (bytesRead === 0 || sink.cancelled) return;
      await sink.drained();
    }
  } finally {
    await handle.close();
  }
}

async function writeArchive(zip: Zip, sink: Sink, source: { pool: Pool; plan: ExportPlan }): Promise<void> {
  const { pool, plan } = source;
  const allocate = createNameAllocator();
  for await (const row of exportedNotes(pool)) {
    if (sink.cancelled) return;
    const path = `notes/${allocate(safeFileName(row.title, "untitled"), ".md")}`;
    const file = entry(new ZipDeflate(path, { level: 6 }), row.updated_at);
    zip.add(file);
    file.push(strToU8(noteMarkdown(toExportNote(row), plan.hrefs)), true);
    await sink.drained();
  }
  for (const attachment of plan.attachments) {
    if (sink.cancelled) return;
    await writeAttachment(zip, sink, attachment);
  }
  zip.end();
}

/** Zip bytes produced on demand: the writer waits whenever the download falls behind. */
function archiveStream(source: { pool: Pool; plan: ExportPlan }): ReadableStream<Uint8Array> {
  let cancelled = false;
  let resume: (() => void) | undefined;
  const wake = () => {
    resume?.();
    resume = undefined;
  };
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const zip = new Zip((error, chunk, final) => {
        if (cancelled) return;
        if (error) return controller.error(error);
        controller.enqueue(chunk);
        if (final) controller.close();
      });
      const sink: Sink = {
        get cancelled() { return cancelled; },
        async drained() {
          while (!cancelled && (controller.desiredSize ?? 0) <= 0) await new Promise<void>((resolve) => { resume = resolve; });
        },
      };
      void writeArchive(zip, sink, source).catch((error: unknown) => {
        zip.terminate();
        if (!cancelled) controller.error(error);
      });
    },
    pull: wake,
    cancel() {
      cancelled = true;
      wake();
    },
  }, new ByteLengthQueuingStrategy({ highWaterMark: BUFFERED_BYTES }));
}

/** The whole export as a streamed zip download (notes/*.md plus attachments/*). */
export async function exportResponse(now: Date = new Date()): Promise<Response> {
  const pool = await db();
  // Planning runs before the first byte, so its failures still become a JSON error response.
  const plan = await planAttachments(pool);
  return new Response(archiveStream({ pool, plan }), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename=${exportFileName(now)}`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
