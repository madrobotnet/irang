import { handleListMessages, handlePostMessage } from "@/server/chat/http";

export const runtime = "nodejs";

type Params = { params: Promise<{ threadId: string }> };

export async function GET(request: Request, { params }: Params) {
  const { threadId } = await params;
  return handleListMessages(threadId, request);
}

export async function POST(request: Request, { params }: Params) {
  const { threadId } = await params;
  return handlePostMessage(threadId, request);
}
