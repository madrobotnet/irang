import { handleProposeEdit } from "@/server/chat/http";

export const runtime = "nodejs";

type Params = { params: Promise<{ threadId: string }> };

export async function POST(request: Request, { params }: Params) {
  const { threadId } = await params;
  return handleProposeEdit(threadId, request);
}
