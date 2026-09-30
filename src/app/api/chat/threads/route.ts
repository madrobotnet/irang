import { z } from "zod";
import { createChatThread, listChatThreads } from "@/server/chat/service";
import { json, parseJson, withApi } from "@/server/http";
import { localeFromRequest } from "@/lib/i18n/server";

export const runtime = "nodejs";
const CreateBody = z.object({ title: z.string().trim().min(1).max(300).optional() }).strict();

export const GET = withApi(async (request) => json({ threads: await listChatThreads(localeFromRequest(request)) }));
export const POST = withApi(async (request) => {
  const locale = localeFromRequest(request);
  const input = await parseJson(request, CreateBody);
  return json({ thread: await createChatThread(input.title, locale) }, { status: 201 });
});
