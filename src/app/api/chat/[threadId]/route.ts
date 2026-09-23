import { handleArchiveThread, handleGetThread } from "@/server/chat/http";

export const runtime = "nodejs";

type Params = { params: Promise<{ threadId: string }> };

export async function GET(request: Request, { params }: Params) {
  const { threadId } = await params;
  return handleGetThread(threadId, request);
}

export async function DELETE(_request: Request, { params }: Params) {
  const { threadId } = await params;
  return handleArchiveThread(threadId);
}
