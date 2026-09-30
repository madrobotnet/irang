import { json, withApi } from "@/server/http";
import { getNoteLinks } from "@/server/notes/service";

type Context = { params: Promise<{ id: string }> };
export const GET = withApi<Context>(async (_request, { params }) => {
  const { id } = await params;
  return json(await getNoteLinks(id));
});
