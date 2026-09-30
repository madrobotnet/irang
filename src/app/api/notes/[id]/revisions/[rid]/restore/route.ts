import { json, withApi } from "@/server/http";
import { restoreRevision } from "@/server/notes/revisions";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string; rid: string }> };

export const POST = withApi<Context>(async (_request, { params }) => {
  const { id, rid } = await params;
  return json({ note: await restoreRevision(id, rid) });
});
