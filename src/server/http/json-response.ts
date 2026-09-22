import { applySecurityHeaders } from "@/lib/auth/security-headers";

export function jsonResponse(body: unknown, status: number): Response {
  const headers = new Headers({ "content-type": "application/json; charset=utf-8" });
  applySecurityHeaders(headers);
  return new Response(JSON.stringify(body), { status, headers });
}
