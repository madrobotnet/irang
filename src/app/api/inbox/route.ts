import { handleInboxCommand, handleListInbox } from "@/server/notes/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return handleListInbox(request);
}

export async function POST(request: Request) {
  return handleInboxCommand(request);
}
