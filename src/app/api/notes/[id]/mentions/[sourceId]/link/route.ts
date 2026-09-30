import { z } from "zod";
import { json, parseJson, withApi } from "@/server/http";
import { linkMention } from "@/server/notes/mentions";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string; sourceId: string }> };
const Body = z.object({ expectedUpdatedAt: z.iso.datetime({ offset: true }) }).strict();

export const POST = withApi<Context>(async (request, { params }) => {
  const { id, sourceId } = await params;
  const { expectedUpdatedAt } = await parseJson(request, Body);
  return json({ note: await linkMention({ targetId: id, sourceId, expectedUpdatedAt }) });
});
