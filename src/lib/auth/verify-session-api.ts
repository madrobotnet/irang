import type { NextRequest } from "next/server";
import { readSessionCookie } from "./cookie";

/**
 * Edge middleware: API routes only. Loopback to Node /api/auth/me (not public HTTPS).
 */
const INTERNAL_SESSION_CHECK_ORIGIN =
  process.env.INTERNAL_APP_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:3000";

export async function hasVerifiedSessionForApi(request: NextRequest): Promise<boolean> {
  const cookie = request.headers.get("cookie");
  if (!readSessionCookie(cookie)) {
    return false;
  }
  try {
    const meUrl = new URL("/api/auth/me", `${INTERNAL_SESSION_CHECK_ORIGIN}/`);
    const response = await fetch(meUrl, {
      headers: { cookie: cookie ?? "" },
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}
