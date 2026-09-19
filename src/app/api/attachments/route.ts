import { handleUploadAttachment } from "@/server/notes/http";

export const runtime = "nodejs";
// Platform multipart body envelope: experimental.middlewareClientMaxBodySize in next.config.ts (102mb).

export async function POST(request: Request) {
  return handleUploadAttachment(request);
}
