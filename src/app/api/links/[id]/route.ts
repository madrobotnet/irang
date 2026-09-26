import { handleDeleteLink } from "@/server/graph/http";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, { params }: Params): Promise<Response> {
  const { id } = await params;
  return handleDeleteLink(id, request);
}
