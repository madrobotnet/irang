import { handleArchiveThread, handleGetThread } from "@/server/chat/http";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  return handleGetThread(id, request);
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  return handleArchiveThread(id);
}
