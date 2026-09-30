import { z } from "zod";
import { json, parseJson, withApi } from "@/server/http";
import { mergeInbox } from "@/server/inbox";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const Body = z.object({
  noteId: z.string().max(100),
  expectedUpdatedAt: z.iso.datetime({ offset: true }).optional(),
}).strict();

export const POST = withApi<Context>(async (request, { params }) => {
  const { id } = await params;
  return json({ note: await mergeInbox(id, await parseJson(request, Body)) });
});
