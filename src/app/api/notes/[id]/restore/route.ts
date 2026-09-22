import { fail as assertNever } from "node:assert/strict";
import { currentSession, notFound, unauthorized } from "@/lib/notes/http";
import { restoreNote } from "@/lib/notes/store";
import { parseNoteId } from "@/lib/notes/schema";

type Context = { readonly params: Promise<{ readonly id: string }> };

export async function POST(request: Request, context: Context) {
  if (await currentSession(request) === null) return unauthorized();
  const id = parseNoteId((await context.params).id);
  if (id === undefined) return notFound();
  const result = await restoreNote(id);
  switch (result.kind) {
    case "restored":
      return Response.json({ note: result.note });
    case "not_found":
      return notFound();
    case "expired":
      return Response.json({ error: "expired" }, { status: 410 });
    default:
      return assertNever(result);
  }
}
