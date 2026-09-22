import { currentSession, notFound, unauthorized } from "@/lib/notes/http";
import { discardInboxItem } from "@/lib/inbox/store";

export async function POST(request: Request, context: { readonly params: Promise<{ readonly id: string }> }) {
  if (await currentSession(request) === null) return unauthorized();
  const discarded = await discardInboxItem((await context.params).id);
  if (!discarded) return notFound();
  return new Response(null, { status: 204 });
}
