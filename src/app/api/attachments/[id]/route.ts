import { handleDeleteAttachment, handleGetAttachment } from "@/server/notes/http";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  return handleGetAttachment(id);
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  return handleDeleteAttachment(id);
}
