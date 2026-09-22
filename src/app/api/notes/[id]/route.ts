import {
  handleDeleteNote,
  handleGetNote,
  handlePatchNote,
} from "@/server/notes/http";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  return handleGetNote(id);
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  return handlePatchNote(id, request);
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  return handleDeleteNote(id);
}
