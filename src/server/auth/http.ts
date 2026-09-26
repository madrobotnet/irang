import { applySecurityHeaders } from "@/lib/auth/security-headers";
import { readSessionCookie, setCookieHeader } from "@/lib/auth/cookie";
import {
  clearedSessionCookieAttributes,
  sessionCookieAttributes,
} from "@/domain/auth/cookie-policy";
import { formatLockRetryCopy } from "@/domain/auth/lockout";
import { errorBody, lockedBody as contractLockedBody, meOkBody, unauthorizedBody } from "@/lib/auth/api-contract";
import { clientKeyFromForwardedHeaders, trustedProxyHopsFromEnv } from "./client-ip";
import {
  authInitFailureBody,
  authInitFailureStatus,
  logAuthInitFailure,
} from "./init-response";
import { AuthStorageInitError } from "./init-errors";
import { getAuthRuntime, loadAuthEnv } from "./runtime";
import type { AuthService } from "./service";

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
  return clientKeyFromForwardedHeaders(
    request.headers.get("x-forwarded-for"),
    request.headers.get("x-real-ip"),
    trustedProxyHopsFromEnv(),
  );
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

function storageUnavailableResponse(): Response {
  return json(errorBody("storage_unavailable"), authInitFailureStatus());
}

async function withAuthRuntime(
  run: (service: AuthService) => Promise<Response>,
): Promise<Response> {
  const env = loadAuthEnv();
  try {
    const { service } = await getAuthRuntime();
    try {
      return await run(service);
    } catch (error) {
      if (error instanceof AuthStorageInitError) {
        logAuthInitFailure(error, env.databaseUrl);
        return json(authInitFailureBody(error), authInitFailureStatus());
      }
      console.error("[auth] storage_unavailable: auth handler failed during request");
      return storageUnavailableResponse();
    }
  } catch (error) {
    logAuthInitFailure(error, env.databaseUrl);
    if (error instanceof AuthStorageInitError) {
      return json(authInitFailureBody(error), authInitFailureStatus());
    }
    return storageUnavailableResponse();
  }
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
  const password = await readPassword(request);
  const html = wantsHtml(request);
  const origin = new URL(request.url).origin;
  const clientKey = clientKeyFromRequest(request);

  if (password === null) {
    return html
      ? redirect(`${origin}/login?error=invalid`)
      : json(errorBody("validation"), 400);
  }

  return withAuthRuntime(async (service) => {
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
  });
}

export async function handleLogout(request: Request): Promise<Response> {
  const token = sessionTokenFromRequest(request);
  const clientKey = clientKeyFromRequest(request);
  return withAuthRuntime(async (service) => {
    await service.logout(token, clientKey);
    const cookie = setCookieHeader("", clearedSessionCookieAttributes());
    if (wantsHtml(request)) {
      const origin = new URL(request.url).origin;
      return redirect(`${origin}/login`, cookie);
    }
    const headers = headersWithSecurity();
    headers.append("Set-Cookie", cookie);
    return new Response(null, { status: 204, headers });
  });
}

export async function handleMe(request: Request): Promise<Response> {
  const token = sessionTokenFromRequest(request);
  return withAuthRuntime(async (service) => {
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
  });
}

export async function handleHealth(): Promise<Response> {
  return json({ ok: true }, 200);
}

