import { applySecurityHeaders } from "@/lib/auth/security-headers";
import { readSessionCookie, setCookieHeader } from "@/lib/auth/cookie";
import {
  clearedSessionCookieAttributes,
  sessionCookieAttributes,
} from "@/domain/auth/cookie-policy";
import { formatLockRetryCopy } from "@/domain/auth/lockout";
import { errorBody, lockedBody as contractLockedBody, meOkBody, unauthorizedBody } from "@/lib/auth/api-contract";
import { getAuthRuntime } from "./runtime";

function headersWithSecurity(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  applySecurityHeaders(headers);
  return headers;
}

function json(body: unknown, status: number): Response {
  const headers = headersWithSecurity({ "content-type": "application/json; charset=utf-8" });
  return new Response(JSON.stringify(body), { status, headers });
}

function redirect(location: string, cookie?: string): Response {
  const headers = headersWithSecurity({ Location: location });
  if (cookie) {
    headers.append("Set-Cookie", cookie);
  }
  return new Response(null, { status: 302, headers });
}

function wantsHtml(request: Request): boolean {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return true;
  }
  if (contentType.includes("multipart/form-data")) {
    return true;
  }
  const accept = request.headers.get("accept") ?? "";
  return accept.includes("text/html") && !accept.includes("application/json");
}

export function clientKeyFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) {
    return real;
  }
  return "local";
}

async function readPassword(request: Request): Promise<string | null> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const body = (await request.json()) as { password?: unknown };
      return typeof body.password === "string" ? body.password : "";
    } catch {
      return "";
    }
  }
  const form = await request.formData();
  const value = form.get("password");
  return typeof value === "string" ? value : "";
}

function sessionTokenFromRequest(request: Request): string | null {
  return readSessionCookie(request.headers.get("cookie"));
}

function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

function lockedResponseBody(retryAfterMs: number, lockedUntil: number) {
  const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return contractLockedBody({
    retryAfterSec,
    unlockAt: toIso(lockedUntil),
    message: formatLockRetryCopy(retryAfterMs),
  });
}

export async function handleLogin(request: Request): Promise<Response> {
  const { service } = await getAuthRuntime();
  const password = await readPassword(request);
  const html = wantsHtml(request);
  const origin = new URL(request.url).origin;
  const clientKey = clientKeyFromRequest(request);

  if (password === null) {
    return html
      ? redirect(`${origin}/login?error=invalid`)
      : json(errorBody("validation"), 400);
  }

  const result = await service.login({ password, clientKey });

  if (result.kind === "misconfigured") {
    return html
      ? redirect(`${origin}/login?error=config`)
      : json(errorBody("misconfigured"), 503);
  }

  if (result.kind === "validation") {
    return html
      ? redirect(`${origin}/login?error=invalid`)
      : json(errorBody("validation"), 400);
  }

  if (result.kind === "locked") {
    const body = lockedResponseBody(result.retryAfterMs, result.lockedUntil);
    if (html) {
      return redirect(`${origin}/login?error=locked&retry=${body.retryAfterSec}`);
    }
    return json(body, 429);
  }

  if (result.kind === "bad_password") {
    return html
      ? redirect(`${origin}/login?error=invalid`)
      : json(errorBody("bad_password"), 401);
  }

  const cookie = setCookieHeader(result.sessionToken, sessionCookieAttributes());
  if (html) {
    return redirect(`${origin}/`, cookie);
  }
  const headers = headersWithSecurity({ "content-type": "application/json; charset=utf-8" });
  headers.append("Set-Cookie", cookie);
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}

export async function handleLogout(request: Request): Promise<Response> {
  const { service } = await getAuthRuntime();
  const token = sessionTokenFromRequest(request);
  await service.logout(token, clientKeyFromRequest(request));
  const cookie = setCookieHeader("", clearedSessionCookieAttributes());
  if (wantsHtml(request)) {
    const origin = new URL(request.url).origin;
    return redirect(`${origin}/login`, cookie);
  }
  const headers = headersWithSecurity();
  headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 204, headers });
}

export async function handleMe(request: Request): Promise<Response> {
  const { service } = await getAuthRuntime();
  const token = sessionTokenFromRequest(request);
  const session = await service.lookup(token);
  if (!session) {
    return json(unauthorizedBody(), 401);
  }
  return json(
    meOkBody({
      publicId: session.publicId,
      createdAt: toIso(session.createdAt),
      expiresAt: toIso(session.expiresAt),
    }),
    200,
  );
}

export async function handleHealth(): Promise<Response> {
  return json({ ok: true }, 200);
}

