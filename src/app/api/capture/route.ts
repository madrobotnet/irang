import { handleCapture } from "@/server/notes/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleCapture(request);
}
