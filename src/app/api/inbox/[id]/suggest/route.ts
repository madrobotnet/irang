import { json, withApi } from "@/server/http";
import { suggestInbox } from "@/server/inbox";
import { localeFromRequest } from "@/lib/i18n/server";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export const POST = withApi<Context>(async (request, { params }) => {
  const { id } = await params;
  return json({ item: await suggestInbox(id, localeFromRequest(request)) });
});
