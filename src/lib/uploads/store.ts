import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { getDb } from "../../db/client";
import type { AcceptedUpload } from "./read";
import { storedFilename, uploadRoot } from "./policy";

const dbByteSize = z.union([
  z.number().int().nonnegative(),
  z.string().regex(/^\d+$/u).transform((value) => Number(value)),
]);

const storedAttachmentSchema = z.object({
  id: z.uuid().brand("AttachmentId"),
  filename: z.string(),
  mime: z.string(),
  byteSize: dbByteSize,
  storageKey: z.string(),
  createdAt: z.date(),
}).readonly();

export type StoredAttachment = z.infer<typeof storedAttachmentSchema>;

export async function storeUpload(file: AcceptedUpload): Promise<StoredAttachment> {
  const id = randomUUID();
  const root = uploadRoot();
  await mkdir(root, { recursive: true });
  const path = join(root, id);
  await writeFile(path, file.bytes);
  let row: unknown;
  try {
    const rows = await getDb()`
      INSERT INTO attachments (id, note_id, inbox_item_id, filename, mime, byte_size, storage_key, created_at)
      VALUES (
        ${id},
        ${null},
        ${null},
        ${storedFilename(file.filename)},
        ${file.mime},
        ${file.bytes.byteLength},
        ${id},
        ${new Date()}
      )
      RETURNING
        id,
        filename,
        mime,
        byte_size::float8 AS "byteSize",
        storage_key AS "storageKey",
        created_at AS "createdAt"
    `;
    row = rows[0];
  } catch (error) {
    await unlink(path);
    throw error;
  }
  return storedAttachmentSchema.parse(row);
}
