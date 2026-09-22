import { currentSession, notFound, unauthorized } from "@/lib/notes/http";
import { applySuggestion } from "@/lib/tags/store";

export async function POST(request: Request, context: { readonly params: Promise<{ readonly id: string }> }) {
  if (await currentSession(request) === null) return unauthorized();
  const applied = await applySuggestion((await context.params).id);
  if (applied === null) return notFound();
  return Response.json(applied);
}
