import { json, withApi } from "@/server/http";
import { listRevisions } from "@/server/notes/revisions";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export const GET = withApi<Context>(async (_request, { params }) => {
  const { id } = await params;
  return json({ revisions: await listRevisions(id) });
});
