import { z } from "zod";
import { ApiError, json, parseJson, withApi } from "@/server/http";
import { getNote, purgeNote, trashNote, updateNote } from "@/server/notes/service";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const UpdateBody = z.object({
  title: z.string().max(300).optional(),
  body: z.string().max(2_000_000).optional(),
  tags: z.array(z.string().min(1).max(100)).max(100).optional(),
  aliases: z.array(z.string().min(1).max(300)).max(100).optional(),
  pinned: z.boolean().optional(),
  archived: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "변경할 내용을 입력해 주세요.");

export const GET = withApi<Context>(async (_request, { params }) => {
  const { id } = await params;
  const note = await getNote(id);
  if (!note) throw new ApiError("not_found", "노트를 찾을 수 없습니다.");
  return json({ note });
});

export const PATCH = withApi<Context>(async (request, { params }) => {
  const { id } = await params;
  return json({ note: await updateNote(id, await parseJson(request, UpdateBody)) });
});

export const DELETE = withApi<Context>(async (request, { params }) => {
  const { id } = await params;
  if (new URL(request.url).searchParams.get("purge") === "1") {
    await purgeNote(id);
    return json({ ok: true });
  }
  return json({ note: await trashNote(id) });
});
