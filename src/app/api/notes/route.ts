import { currentSession, unauthorized } from "@/lib/notes/http";
import { createNote, listActiveNotes } from "@/lib/notes/store";
import { parseCreateNoteInput } from "@/lib/notes/schema";

export async function GET(request: Request) {
  if (await currentSession(request) === null) return unauthorized();
  return Response.json({ notes: await listActiveNotes() });
}

export async function POST(request: Request) {
  if (await currentSession(request) === null) return unauthorized();
  const raw: unknown = await request.json().catch((error: unknown) => {
    if (error instanceof SyntaxError) return null;
    throw error;
  });
  const input = parseCreateNoteInput(raw);
  if (input === undefined) return Response.json({ error: "invalid_request" }, { status: 400 });
  const note = await createNote(input);
  return Response.json({ note }, { status: 201 });
}
