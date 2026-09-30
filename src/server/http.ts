import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { getSession } from "@/server/auth/session";
import type { LocalizedText } from "@/lib/i18n/locale";
import { httpCopy } from "@/server/i18n/copy";
import { issuesText } from "@/lib/i18n/validation";
import { AI_FIELD_COPY } from "@/server/i18n/ai-field-copy";

export type ApiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "validation"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "payload_too_large"
  | "unavailable"
  | "upstream_failed"
  | "internal";

const STATUS: Record<ApiErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  validation: 400,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  payload_too_large: 413,
  unavailable: 503,
  upstream_failed: 502,
  internal: 500,
};

export class ApiError extends Error {
  readonly localized?: LocalizedText;

  constructor(
    readonly code: ApiErrorCode,
    message: string | LocalizedText,
    readonly extra?: Record<string, unknown>,
  ) {
    super(typeof message === "string" ? message : message.en);
    if (typeof message !== "string") this.localized = message;
    this.name = "ApiError";
  }
}

export function json<T>(data: T, init?: ResponseInit): NextResponse {
  const response = NextResponse.json(data, init);
  response.headers.set("cache-control", "private, no-store");
  return response;
}

export function errorResponse(code: ApiErrorCode, message: string | LocalizedText, extra?: Record<string, unknown>): NextResponse {
  const response = json({
    error: {
      code,
      message: typeof message === "string" ? message : message.en,
      ...extra,
      ...(typeof message === "string" ? {} : { localized: message }),
    },
  }, { status: STATUS[code] });
  if (code === "rate_limited" && typeof extra?.retryAfterSeconds === "number") {
    response.headers.set("retry-after", String(extra.retryAfterSeconds));
  }
  return response;
}

/** Parse a JSON request body with a zod schema; throws ApiError("validation"). */
export async function parseJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  const contentType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new ApiError("validation", httpCopy.jsonContentType);
  }
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiError("validation", httpCopy.jsonBody);
  }
  return schema.parse(raw);
}

type Handler<C> = (request: Request, context: C) => Promise<Response>;

function requireSameOrigin(request: Request): void {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const origin = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    throw new ApiError("forbidden", httpCopy.crossSite);
  }
  if (origin) {
    // Host preserves the public authority when TLS terminates at the proxy.
    const authority = request.headers.get("host") ?? new URL(request.url).host;
    let originUrl: URL;
    try {
      originUrl = new URL(origin);
    } catch {
      throw new ApiError("forbidden", httpCopy.badOrigin);
    }
    if (!["http:", "https:"].includes(originUrl.protocol) || originUrl.host !== authority) {
      throw new ApiError("forbidden", httpCopy.crossOrigin);
    }
  }
}

function toResponse(error: unknown, request: Request): Response {
  if (error instanceof ApiError) return errorResponse(error.code, error.localized ?? error.message, error.extra);
  if (error instanceof ZodError) {
    const aiRoute = /^\/api\/(?:setup$|settings\/ai(?:\/|$)|ai\/auth(?:\/|$))/.test(new URL(request.url).pathname);
    const fields = aiRoute ? AI_FIELD_COPY : undefined;
    return errorResponse("validation", {
      ko: issuesText("ko", error.issues, fields),
      en: issuesText("en", error.issues, fields),
    });
  }
  console.error("[api] unhandled error", error);
  return errorResponse("internal", httpCopy.internal);
}

/** Session-protected route handler with uniform error mapping. */
export function withApi<C = unknown>(handler: Handler<C>): Handler<C> {
  return async (request, context) => {
    try {
      requireSameOrigin(request);
      const session = await getSession();
      if (!session) return errorResponse("unauthorized", httpCopy.loginRequired);
      return await handler(request, context);
    } catch (error) {
      return toResponse(error, request);
    }
  };
}

/** Public route handler (no session) with uniform error mapping. */
export function withPublicApi<C = unknown>(handler: Handler<C>): Handler<C> {
  return async (request, context) => {
    try {
      requireSameOrigin(request);
      return await handler(request, context);
    } catch (error) {
      return toResponse(error, request);
    }
  };
}
