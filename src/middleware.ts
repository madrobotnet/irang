import { NextRequest, NextResponse } from "next/server";
import { decideAuthGate, isPublicPath } from "@/lib/auth/gate";
import { applySecurityHeaders } from "@/lib/auth/security-headers";
import { unauthorizedJsonResponse } from "@/lib/auth/api-errors";
import { hasVerifiedSession } from "@/lib/auth/verify-session";
import {
  attachmentPayloadTooLargeResponse,
  isAttachmentRequestBodyTooLarge,
  isAttachmentUploadPost,
  parseContentLengthHeader,
} from "@/lib/notes/attachment-upload-limit";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const hasValidSessionToken = isPublicPath(pathname)
    ? false
    : await hasVerifiedSession(request);

  const decision = decideAuthGate({
    pathname,
    hasValidSessionToken,
  });

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
  } else if (
    isAttachmentUploadPost(pathname, request.method) &&
    isAttachmentRequestBodyTooLarge(parseContentLengthHeader(request.headers))
  ) {
    const tooLarge = attachmentPayloadTooLargeResponse();
    response = new NextResponse(tooLarge.body, {
      status: tooLarge.status,
      headers: tooLarge.headers,
    });
  } else {
    response = NextResponse.next();
  }
  applySecurityHeaders(response.headers);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
