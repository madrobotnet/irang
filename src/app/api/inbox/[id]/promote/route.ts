import { z } from "zod";
import { json, parseJson, withApi } from "@/server/http";
import { promoteInbox } from "@/server/inbox";
import { localeFromRequest } from "@/lib/i18n/server";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const PromoteBody = z.object({
  title: z.string().max(300).optional(),
  body: z.string().max(2_000_000).optional(),
  tags: z.array(z.string().min(1).max(100)).max(100).optional(),
}).strict();

export const POST = withApi<Context>(async (request, { params }) => {
  const { id } = await params;
  return json({ note: await promoteInbox(id, await parseJson(request, PromoteBody), localeFromRequest(request)) });
});
