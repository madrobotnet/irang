import { currentSession, unauthorized } from "@/lib/notes/http";
import { runNightlyIndex } from "@/lib/search/store";

export async function POST(request: Request) {
  if (await currentSession(request) === null) return unauthorized();
  return Response.json({ indexed: await runNightlyIndex() });
}
