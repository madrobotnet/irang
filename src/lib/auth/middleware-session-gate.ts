import type { NextRequest } from "next/server";
import { readSessionCookie } from "./cookie";
import { isApiPath, isPublicPath } from "./gate";
import { hasVerifiedSessionForApi } from "./verify-session-api";

/**
 * Pages: cookie presence only — (app)/layout verifies in-process (no middleware fetch).
 * APIs: loopback /api/auth/me on Edge (cannot import pg/argon2).
 */
export async function hasValidSessionForMiddleware(
  request: NextRequest,
  pathname: string,
): Promise<boolean> {
  if (isPublicPath(pathname)) {
    return false;
  }
  const token = readSessionCookie(request.headers.get("cookie"));
  if (!token) {
    return false;
  }
  if (!isApiPath(pathname)) {
    return true;
  }
  return hasVerifiedSessionForApi(request).catch(() => false);
}
