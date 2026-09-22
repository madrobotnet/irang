import { currentSession, unauthorized } from "@/lib/notes/http";
import { indexStatus, keywordSearch } from "@/lib/search/store";

export async function GET(request: Request) {
  if (await currentSession(request) === null) return unauthorized();
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const tag = url.searchParams.get("tag")?.trim() || undefined;
  if (query === "") return Response.json({ error: "invalid_request" }, { status: 400 });
  return Response.json({
    indexStatus: await indexStatus(),
    hits: await keywordSearch(query, tag),
  });
}
