import { currentSession, notFound, unauthorized } from "@/lib/notes/http";
import { getActiveNote, softDeleteNote, updateNote } from "@/lib/notes/store";
import { parseNoteId, parseUpdateNoteInput } from "@/lib/notes/schema";

type Context = { readonly params: Promise<{ readonly id: string }> };

export async function GET(request: Request, context: Context) {
  if (await currentSession(request) === null) return unauthorized();
  const id = parseNoteId((await context.params).id);
  if (id === undefined) return notFound();
  const note = await getActiveNote(id);
  if (note === null) return notFound();
  return Response.json({ note });
}

export async function PATCH(request: Request, context: Context) {
  if (await currentSession(request) === null) return unauthorized();
  const id = parseNoteId((await context.params).id);
  if (id === undefined) return notFound();
  const raw: unknown = await request.json().catch((error: unknown) => {
    if (error instanceof SyntaxError) return null;
    throw error;
  });
  const input = parseUpdateNoteInput(raw);
  if (input === undefined) return Response.json({ error: "invalid_request" }, { status: 400 });
  const note = await updateNote(id, input);
  if (note === null) return notFound();
  return Response.json({ note });
}

export async function DELETE(request: Request, context: Context) {
  if (await currentSession(request) === null) return unauthorized();
  const id = parseNoteId((await context.params).id);
  if (id === undefined) return notFound();
  const deleted = await softDeleteNote(id);
  if (!deleted) return notFound();
  return new Response(null, { status: 204 });
}
