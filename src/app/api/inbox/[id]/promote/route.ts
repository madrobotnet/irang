import { currentSession, notFound, unauthorized } from "@/lib/notes/http";
import { promoteInboxItem } from "@/lib/inbox/store";

export async function POST(request: Request, context: { readonly params: Promise<{ readonly id: string }> }) {
  if (await currentSession(request) === null) return unauthorized();
  const result = await promoteInboxItem((await context.params).id);
  if (result === null) return notFound();
  return Response.json(result);
}
