import { resolveSession, SESSION_COOKIE } from "@/lib/auth/session";
import type { Session } from "@/lib/auth/session";

function sessionToken(request: Request): string | undefined {
  const cookie = request.headers.get("cookie");
  if (cookie === null) return undefined;
  for (const part of cookie.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === SESSION_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export async function currentSession(request: Request): Promise<Session | null> {
  const token = sessionToken(request);
  return token === undefined ? null : await resolveSession(token);
}

export function unauthorized(): Response {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}

export function notFound(): Response {
  return Response.json({ error: "not_found" }, { status: 404 });
}
