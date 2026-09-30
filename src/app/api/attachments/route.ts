import { ApiError, json, withApi } from "@/server/http";
import { saveAttachment } from "@/server/notes/attachments";
import { attachmentCopy } from "@/server/i18n/copy";

export const runtime = "nodejs";
export const POST = withApi(async (request) => {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 26 * 1024 * 1024) throw new ApiError("payload_too_large", attachmentCopy.tooLarge);
  let form: FormData;
  try { form = await request.formData(); }
  catch { throw new ApiError("validation", attachmentCopy.badMultipart); }
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError("validation", attachmentCopy.noFile);
  const noteValue = form.get("noteId");
  if (noteValue !== null && typeof noteValue !== "string") throw new ApiError("validation", attachmentCopy.badNoteId);
  const attachment = await saveAttachment(file, noteValue || undefined);
  const url = `/api/attachments/${attachment.id}`;
  const markdown = attachment.mime.startsWith("image/")
    ? `![${attachment.filename}](${url})`
    : `[${attachment.filename}](${url})`;
  return json({ id: attachment.id, url, filename: attachment.filename, mime: attachment.mime, markdown }, { status: 201 });
});
