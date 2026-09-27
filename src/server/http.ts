import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { getSession } from "@/server/auth/session";

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
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly extra?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function json<T>(data: T, init?: ResponseInit): NextResponse {
  const response = NextResponse.json(data, init);
  response.headers.set("cache-control", "private, no-store");
  return response;
}

export function errorResponse(code: ApiErrorCode, message: string, extra?: Record<string, unknown>): NextResponse {
  const response = json({ error: { code, message, ...extra } }, { status: STATUS[code] });
  if (code === "rate_limited" && typeof extra?.retryAfterSeconds === "number") {
    response.headers.set("retry-after", String(extra.retryAfterSeconds));
  }
  return response;
}

/** Parse a JSON request body with a zod schema; throws ApiError("validation"). */
export async function parseJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  const contentType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new ApiError("validation", "Content-Type must be application/json");
  }
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiError("validation", "Request body must be JSON");
  }
  return schema.parse(raw);
}

type Handler<C> = (request: Request, context: C) => Promise<Response>;

function requireSameOrigin(request: Request): void {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const origin = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    throw new ApiError("forbidden", "Cross-site requests are not allowed");
  }
  if (origin) {
    // Host preserves the public authority when TLS terminates at the proxy.
    const authority = request.headers.get("host") ?? new URL(request.url).host;
    let originUrl: URL;
    try {
      originUrl = new URL(origin);
    } catch {
      throw new ApiError("forbidden", "Invalid request origin");
    }
    if (!["http:", "https:"].includes(originUrl.protocol) || originUrl.host !== authority) {
      throw new ApiError("forbidden", "Cross-origin requests are not allowed");
    }
  }
}

function toResponse(error: unknown): Response {
  if (error instanceof ApiError) return errorResponse(error.code, error.message, error.extra);
  if (error instanceof ZodError) {
    return errorResponse("validation", error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "));
  }
  console.error("[api] unhandled error", error);
  return errorResponse("internal", "Something went wrong");
}

/** Session-protected route handler with uniform error mapping. */
export function withApi<C = unknown>(handler: Handler<C>): Handler<C> {
  return async (request, context) => {
    try {
      requireSameOrigin(request);
      const session = await getSession();
      if (!session) return errorResponse("unauthorized", "Login required");
      return await handler(request, context);
    } catch (error) {
      return toResponse(error);
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
      return toResponse(error);
    }
  };
}
