import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export function attachmentsDir(): string {
  return process.env.ATTACHMENTS_DIR?.trim() || path.join(process.cwd(), ".data", "attachments");
}

export async function storeAttachmentFile(
  filename: string,
  bytes: Uint8Array,
): Promise<string> {
  const dir = attachmentsDir();
  await mkdir(dir, { recursive: true });
  const key = `${randomUUID()}-${path.basename(filename)}`;
  const full = path.join(dir, key);
  await writeFile(full, bytes);
  return key;
}

export async function readAttachmentFile(storageKey: string): Promise<Uint8Array> {
  const full = path.join(attachmentsDir(), storageKey);
  return readFile(full);
}

export async function deleteAttachmentFile(storageKey: string): Promise<void> {
  const full = path.join(attachmentsDir(), storageKey);
  await unlink(full).catch(() => undefined);
}
