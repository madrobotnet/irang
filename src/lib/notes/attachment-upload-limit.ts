import { noteErrorBody } from "@/lib/api/note-contract";
import { applySecurityHeaders } from "@/lib/auth/security-headers";
import { ATTACHMENT_MAX_REQUEST_BODY_BYTES } from "@/domain/notes/attachment-request-limit";

export { ATTACHMENT_MAX_REQUEST_BODY_BYTES } from "@/domain/notes/attachment-request-limit";

export function parseContentLengthHeader(headers: Headers): number | null {
  const raw = headers.get("content-length");
  if (raw === null || raw === "") {
    return null;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) {
    return null;
  }
  return n;
}

export function isAttachmentRequestBodyTooLarge(contentLength: number | null): boolean {
  if (contentLength === null) {
    return false;
  }
  return contentLength > ATTACHMENT_MAX_REQUEST_BODY_BYTES;
}

export function isAttachmentUploadPost(pathname: string, method: string): boolean {
  return method === "POST" && pathname === "/api/attachments";
}

export function attachmentPayloadTooLargeResponse(): Response {
  const headers = new Headers({ "content-type": "application/json; charset=utf-8" });
  applySecurityHeaders(headers);
  return new Response(JSON.stringify(noteErrorBody("payload_too_large")), { status: 413, headers });
}
