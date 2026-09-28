import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "sb_session";
const PUBLIC_PREFIXES = ["/login", "/api/auth/login", "/api/health", "/manifest.webmanifest", "/icons/", "/fonts/", "/favicon"];

/**
 * Cheap gate: requests without a session cookie never reach app pages or APIs.
 * The real session check (DB) happens in the (app) layout and in withApi().
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/setup" || pathname === "/api/setup" || PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) {
    return NextResponse.next();
  }
  if (request.cookies.get(SESSION_COOKIE)?.value) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Login required" } }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|sw.js).*)"],
};
