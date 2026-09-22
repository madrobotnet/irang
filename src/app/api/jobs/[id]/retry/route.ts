import { getDb } from "@/db/client";
import { markJob } from "@/lib/jobs/store";
import { currentSession, notFound, unauthorized } from "@/lib/notes/http";

export async function POST(request: Request, context: { readonly params: Promise<{ readonly id: string }> }) {
  if (await currentSession(request) === null) return unauthorized();
  const id = (await context.params).id;
  const [job] = await getDb()`SELECT payload FROM ai_jobs WHERE id = ${id} AND status = 'failed'`;
  if (job === undefined) return notFound();
  const payload = job["payload"] as { url?: string };
  const url = payload.url;
  if (url === undefined) {
    await markJob(id, "failed", "missing url");
    return Response.json({ error: "missing_url" }, { status: 422 });
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) {
    await markJob(id, "failed", `status ${response.status}`);
    return Response.json({ error: "retry_failed" }, { status: 502 });
  }
  await markJob(id, "succeeded", null);
  return Response.json({ ok: true });
}
