import type { NextRequest } from "next/server";
import { listSessions, resolveSession, SESSION_COOKIE } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await resolveSession(token) : null;
  if (session === null) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json({ sessions: await listSessions() });
}
