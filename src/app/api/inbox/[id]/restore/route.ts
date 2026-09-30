import { json, withApi } from "@/server/http";
import { restoreInbox } from "@/server/inbox";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export const POST = withApi<Context>(async (_request, { params }) => {
  const { id } = await params;
  return json({ item: await restoreInbox(id) });
});
