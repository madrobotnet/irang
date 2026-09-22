import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decideAccess } from "./lib/auth/guard";
import type { AccessDecision } from "./lib/auth/guard";
import { resolveSession, SESSION_COOKIE } from "./lib/auth/session";

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await resolveSession(token) : null;
  // Logout is an idempotent public POST: even stale cookies must be clearable.
  const decision = request.method === "POST" && request.nextUrl.pathname === "/api/auth/logout"
    ? "allow"
    : decideAccess({ pathname: request.nextUrl.pathname, hasValidSession: session !== null });
  const responses = {
    allow: () => NextResponse.next(),
    redirect_login: () => NextResponse.redirect(new URL("/login", request.url), 302),
    unauthorized: () => NextResponse.json({ error: "unauthorized" }, { status: 401 }),
  } satisfies Record<AccessDecision, () => NextResponse>;
  const response = responses[decision]();
  if (request.headers.get("x-forwarded-proto") === "https" || process.env["BRAIN_COOKIE_SECURE"] === "true") {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  return response;
}
