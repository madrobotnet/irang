import { z } from "zod";
import { json, withApi } from "@/server/http";
import { searchNotes } from "@/server/search/service";

const searchParamsSchema = z.object({
  q: z.string().max(500).default(""),
  tag: z.string().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const GET = withApi(async (request) => {
  const url = new URL(request.url);
  const input = searchParamsSchema.parse({
    q: url.searchParams.get("q") ?? undefined,
    tag: url.searchParams.get("tag") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  return json(await searchNotes(input.q, { tag: input.tag, limit: input.limit }));
});
