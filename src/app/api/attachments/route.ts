import { handleUploadAttachment } from "@/server/notes/http";

export const runtime = "nodejs";
/** Large uploads: see `experimental.middlewareClientMaxBodySize` in `next.config.ts`. */

export async function POST(request: Request) {
  return handleUploadAttachment(request);
}
