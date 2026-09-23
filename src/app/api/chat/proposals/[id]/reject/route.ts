import { handleRejectProposal } from "@/server/chat/http";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;
  return handleRejectProposal(id);
}
