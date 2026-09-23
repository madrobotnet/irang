import { handleCreateThread, handleListThreads } from "@/server/chat/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return handleListThreads(request);
}

export async function POST(request: Request) {
  return handleCreateThread(request);
}
