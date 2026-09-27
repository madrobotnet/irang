import { ApiError, json, withApi } from "@/server/http";
import { saveAttachment } from "@/server/notes/attachments";

export const runtime = "nodejs";
export const POST = withApi(async (request) => {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 26 * 1024 * 1024) throw new ApiError("payload_too_large", "첨부 파일은 25MB 이하여야 합니다.");
  let form: FormData;
  try { form = await request.formData(); }
  catch { throw new ApiError("validation", "올바른 multipart 요청이 아닙니다."); }
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError("validation", "첨부할 파일을 선택해 주세요.");
  const noteValue = form.get("noteId");
  if (noteValue !== null && typeof noteValue !== "string") throw new ApiError("validation", "올바른 노트 ID가 아닙니다.");
  const attachment = await saveAttachment(file, noteValue || undefined);
  const url = `/api/attachments/${attachment.id}`;
  const markdown = attachment.mime.startsWith("image/")
    ? `![${attachment.filename}](${url})`
    : `[${attachment.filename}](${url})`;
  return json({ id: attachment.id, url, filename: attachment.filename, mime: attachment.mime, markdown }, { status: 201 });
});
