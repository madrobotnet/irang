import type { NextRequest } from "next/server";
import { readSessionCookie } from "./cookie";

/**
 * Edge-safe session check: delegates to GET /api/auth/me (same lookup as API handlers).
 * /api/auth/me is middleware-public; handleMe performs cryptographic verification.
 */
export async function hasVerifiedSession(request: NextRequest): Promise<boolean> {
  const cookie = request.headers.get("cookie");
  if (!readSessionCookie(cookie)) {
    return false;
  }
  const meUrl = new URL("/api/auth/me", request.url);
  const response = await fetch(meUrl, {
    headers: { cookie: cookie ?? "" },
    cache: "no-store",
  });
  return response.ok;
}
