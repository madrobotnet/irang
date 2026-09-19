import { handleListInbox } from "@/server/notes/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return handleListInbox(request);
}
