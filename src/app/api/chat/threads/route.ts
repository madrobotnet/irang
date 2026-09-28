import { z } from "zod";
import { createChatThread, listChatThreads } from "@/server/chat/service";
import { json, parseJson, withApi } from "@/server/http";

export const runtime = "nodejs";
const CreateBody = z.object({ title: z.string().trim().min(1).max(300).optional() }).strict();

export const GET = withApi(async () => json({ threads: await listChatThreads() }));
export const POST = withApi(async (request) => {
  const input = await parseJson(request, CreateBody);
  return json({ thread: await createChatThread(input.title) }, { status: 201 });
});
