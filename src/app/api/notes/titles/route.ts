import { z } from "zod";
import { json, withApi } from "@/server/http";
import { findNoteTitles } from "@/server/notes/service";

const Query = z.object({
  q: z.string().max(300).default(""),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
export const GET = withApi(async (request) => {
  const input = Query.parse(Object.fromEntries(new URL(request.url).searchParams));
  return json({ notes: await findNoteTitles(input.q, input.limit) });
});
