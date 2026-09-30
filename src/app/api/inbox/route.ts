import { z } from "zod";
import { json, withApi } from "@/server/http";
import { listInbox } from "@/server/inbox";

export const runtime = "nodejs";
const Query = z.object({ view: z.enum(["open", "later"]).default("open") });

export const GET = withApi(async (request) => {
  const { view } = Query.parse(Object.fromEntries(new URL(request.url).searchParams));
  return json(await listInbox(view));
});
