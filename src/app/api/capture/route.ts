import { after } from "next/server";
import { z } from "zod";
import { captureInbox, enrichInboxItem } from "@/server/inbox";
import { json, parseJson, withApi } from "@/server/http";

export const runtime = "nodejs";

const CaptureBody = z.object({
  text: z.string().max(2_000_000).optional(),
  url: z.string().max(2_000).optional(),
  title: z.string().max(300).optional(),
}).strict();

export const POST = withApi(async (request) => {
  const item = await captureInbox(await parseJson(request, CaptureBody));
  after(async () => { await enrichInboxItem(item.id); });
  return json({ item }, { status: 201 });
});
