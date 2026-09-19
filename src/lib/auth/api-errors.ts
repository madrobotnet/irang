import { unauthorizedBody } from "./api-contract";
import { applySecurityHeaders } from "./security-headers";

export function unauthorizedJsonResponse(): Response {
  const headers = new Headers({ "content-type": "application/json; charset=utf-8" });
  applySecurityHeaders(headers);
  return new Response(JSON.stringify(unauthorizedBody()), { status: 401, headers });
}
