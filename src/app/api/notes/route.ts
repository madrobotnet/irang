import { z } from "zod";
import { json, parseJson, withApi } from "@/server/http";
import { createNote, listNotes } from "@/server/notes/service";
import { purgeExpired, TRASH_LIST_PURGE_BATCH } from "@/server/notes/trash";
import { localeFromRequest } from "@/lib/i18n/server";

export const runtime = "nodejs";

const CreateBody = z.object({
  title: z.string().max(300).optional(),
  body: z.string().max(2_000_000).optional(),
  tags: z.array(z.string().min(1).max(100)).max(100).optional(),
}).strict();
const ListQuery = z.object({
  q: z.string().max(300).optional(),
  tag: z.string().max(100).optional(),
  pinned: z.enum(["1"]).optional(),
  archived: z.enum(["1"]).optional(),
  trash: z.enum(["1"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().max(1000).optional(),
});

export const GET = withApi(async (request) => {
  const url = new URL(request.url);
  const input = ListQuery.parse(Object.fromEntries(url.searchParams));
  if (input.trash === "1" && !input.cursor) await purgeExpired(TRASH_LIST_PURGE_BATCH);
  return json(await listNotes({ ...input, pinned: input.pinned === "1", archived: input.archived === "1", trash: input.trash === "1" }));
});

export const POST = withApi(async (request) => {
  const locale = localeFromRequest(request);
  const input = await parseJson(request, CreateBody);
  return json({ note: await createNote(input, undefined, locale) }, { status: 201 });
});
