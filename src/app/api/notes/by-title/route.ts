import { z } from "zod";
import { json, parseJson, withApi } from "@/server/http";
import { getOrCreateByTitle } from "@/server/notes/service";

const Body = z.object({ title: z.string().trim().min(1).max(300) }).strict();
export const POST = withApi(async (request) => {
  const { title } = await parseJson(request, Body);
  return json({ note: await getOrCreateByTitle(title) });
});
