import { z } from "zod";
import { json, withApi } from "@/server/http";
import { relatedNotes } from "@/server/search/service";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const GET = withApi(async (
  request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  const url = new URL(request.url);
  const { limit } = querySchema.parse({ limit: url.searchParams.get("limit") ?? undefined });
  return json({ notes: await relatedNotes(id, limit) });
});
