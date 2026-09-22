import { listFailedJobs } from "@/lib/jobs/store";
import { currentSession, unauthorized } from "@/lib/notes/http";

export async function GET(request: Request) {
  if (await currentSession(request) === null) return unauthorized();
  return Response.json({ jobs: await listFailedJobs() });
}
