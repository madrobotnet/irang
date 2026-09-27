import { json, withApi } from "@/server/http";
import { discardInbox } from "@/server/inbox";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export const POST = withApi<Context>(async (_request, { params }) => {
  const { id } = await params;
  await discardInbox(id);
  return json({ ok: true });
});
