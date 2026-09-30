import { json, withApi } from "@/server/http";
import { getRevision } from "@/server/notes/revisions";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string; rid: string }> };

export const GET = withApi<Context>(async (_request, { params }) => {
  const { id, rid } = await params;
  return json({ revision: await getRevision(id, rid) });
});
