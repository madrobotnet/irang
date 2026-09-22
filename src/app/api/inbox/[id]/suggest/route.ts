import { TypeSafeMisconfiguredError, suggestLabels } from "@/lib/jev/client";
import { currentSession, unauthorized } from "@/lib/notes/http";
import { listSuggestions, saveSuggestion } from "@/lib/tags/store";
import { getDb } from "@/db/client";

export async function POST(request: Request, context: { readonly params: Promise<{ readonly id: string }> }) {
  if (await currentSession(request) === null) return unauthorized();
  const id = (await context.params).id;
  const [item] = await getDb()`SELECT title, body FROM inbox_items WHERE id = ${id}`;
  if (item === undefined) return Response.json({ error: "not_found" }, { status: 404 });
  try {
    const labels = await suggestLabels(`${String(item["title"])}\n${String(item["body"])}`);
    for (const label of labels) await saveSuggestion(id, label.label, label.probability);
    return Response.json({ suggestions: await listSuggestions(id) });
  } catch (error) {
    if (error instanceof TypeSafeMisconfiguredError) {
      return Response.json({ error: "typesafe_misconfigured" }, { status: 503 });
    }
    throw error;
  }
}
