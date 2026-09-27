import { z } from "zod";
import { createChatMessageStream } from "@/server/chat/service";
import { parseJson, withApi } from "@/server/http";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const MessageBody = z.object({ content: z.string().trim().min(1).max(8_000) }).strict();

export const POST = withApi<Context>(async (request, { params }) => {
  const { id } = await params;
  const input = await parseJson(request, MessageBody);
  return createChatMessageStream(id, input.content, { signal: request.signal });
});
