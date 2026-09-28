import { cookies } from "next/headers";
import { AuthStartInputSchema } from "@/lib/ai-auth-flow";
import { AI_AUTH_COOKIE, authBrowserIdentity, authorizeAiAuth } from "@/server/ai-auth/access";
import { startAuthAttempt } from "@/server/ai-auth/start";
import { json, parseJson, withPublicApi } from "@/server/http";

export const runtime = "nodejs";

export const POST = withPublicApi(async (request) => {
  const input = await parseJson(request, AuthStartInputSchema);
  const scope = await authorizeAiAuth(request, input.setupToken);
  const browser = authBrowserIdentity(request);
  const attempt = await startAuthAttempt({
    ...input, callbackOrigin: request.headers.get("origin") ?? new URL(request.url).origin,
  }, { ...scope, browserHash: browser.hash }, { signal: request.signal });
  (await cookies()).set(AI_AUTH_COOKIE, browser.key, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 3600,
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1",
  });
  return json(attempt, { status: 201 });
});
