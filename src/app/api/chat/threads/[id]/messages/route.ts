import { handleListMessages, handlePostMessage } from "@/server/chat/http";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  return handleListMessages(id, request);
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return handlePostMessage(id, request);
}
