import { currentSession, unauthorized } from "@/lib/notes/http";
import { listTrash } from "@/lib/notes/store";

export async function GET(request: Request) {
  if (await currentSession(request) === null) return unauthorized();
  return Response.json({ notes: await listTrash() });
}
