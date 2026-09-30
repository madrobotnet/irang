import { z } from "zod";
import { json, parseJson, withApi } from "@/server/http";
import { snoozeInbox } from "@/server/inbox";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const Body = z.object({ until: z.iso.datetime({ offset: true }) }).strict();

export const POST = withApi<Context>(async (request, { params }) => {
  const { id } = await params;
  const { until } = await parseJson(request, Body);
  return json({ item: await snoozeInbox(id, new Date(until)) });
});
