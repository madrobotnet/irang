import { z } from "zod";
import { deleteChatThread, getChatThread, updateChatThread } from "@/server/chat/service";
import { json, parseJson, withApi } from "@/server/http";
import { localeFromRequest } from "@/lib/i18n/server";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const UpdateBody = z.object({ title: z.string().trim().min(1).max(300) }).strict();

export const GET = withApi<Context>(async (request, { params }) => {
  const { id } = await params;
  return json(await getChatThread(id, localeFromRequest(request)));
});
export const PATCH = withApi<Context>(async (request, { params }) => {
  const { id } = await params;
  const input = await parseJson(request, UpdateBody);
  return json({ thread: await updateChatThread(id, input.title, localeFromRequest(request)) });
});
export const DELETE = withApi<Context>(async (_request, { params }) => {
  const { id } = await params;
  await deleteChatThread(id);
  return json({ ok: true });
});
