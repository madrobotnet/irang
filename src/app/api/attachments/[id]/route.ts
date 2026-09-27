import { contentDisposition, loadAttachment } from "@/server/notes/attachments";
import { withApi } from "@/server/http";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export const GET = withApi<Context>(async (_request, { params }) => {
  const { id } = await params;
  const { attachment, bytes } = await loadAttachment(id);
  return new Response(new Uint8Array(bytes).buffer, {
    headers: {
      "Content-Type": attachment.mime,
      "Content-Length": String(attachment.sizeBytes),
      "Content-Disposition": contentDisposition(attachment.filename),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=3600",
    },
  });
});
