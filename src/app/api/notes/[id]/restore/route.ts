import { json, withApi } from "@/server/http";
import { restoreNote } from "@/server/notes/service";

type Context = { params: Promise<{ id: string }> };
export const POST = withApi<Context>(async (_request, { params }) => {
  const { id } = await params;
  return json({ note: await restoreNote(id) });
});
