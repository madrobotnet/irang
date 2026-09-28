import { NextResponse } from "next/server";
import { z } from "zod";
import { authBrowserHash } from "@/server/ai-auth/access";
import { finishOpenRouterAuth } from "@/server/ai-auth/callback";
import { withPublicApi } from "@/server/http";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export const GET = withPublicApi<Context>(async (request, context) => {
  const url = new URL(request.url);
  const result = await finishOpenRouterAuth({
    id: z.uuid().parse((await context.params).id), code: url.searchParams.get("code") ?? undefined,
    denied: url.searchParams.has("error"), browserHash: authBrowserHash(request),
  });
  const destination = new URL("/connect/complete", url);
  destination.searchParams.set("status", result.pending ? "pending" : result.success ? "success" : "failed");
  destination.searchParams.set("stage", result.setup ? "setup" : "settings");
  // Keep the browser's public origin rather than Next's internal server origin.
  const response = new NextResponse(null, {
    status: 303,
    headers: { location: `${destination.pathname}${destination.search}` },
  });
  response.headers.set("cache-control", "private, no-store");
  response.headers.set("referrer-policy", "no-referrer");
  return response;
});
