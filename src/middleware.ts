import { NextRequest, NextResponse } from "next/server";
import { decideAuthGate, isPublicPath } from "@/lib/auth/gate";
import {
  applySecurityHeaders,
  CSP_NONCE_HEADER,
  generateCspNonce,
} from "@/lib/auth/security-headers";
import { unauthorizedJsonResponse } from "@/lib/auth/api-errors";
import { hasValidSessionForMiddleware } from "@/lib/auth/middleware-session-gate";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const hasValidSessionToken = await hasValidSessionForMiddleware(request, pathname);

  const decision = decideAuthGate({
    pathname,
    hasValidSessionToken,
  });

  const cspNonce = generateCspNonce();
  let response: NextResponse;

  if (decision.action === "redirect_login") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    response = NextResponse.redirect(url, 302);
  } else if (decision.action === "unauthorized") {
    const body = unauthorizedJsonResponse();
    response = new NextResponse(body.body, {
      status: 401,
      headers: body.headers,
    });
  } else {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(CSP_NONCE_HEADER, cspNonce);
    response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  applySecurityHeaders(response.headers, { cspNonce });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
