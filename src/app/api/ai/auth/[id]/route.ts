import { z } from "zod";
import { AuthScopeInputSchema } from "@/lib/ai-auth-flow";
import { authorizeAiAuth } from "@/server/ai-auth/access";
import { cancelAuthAttempt, pollAuthAttempt } from "@/server/ai-auth/poll";
import { json, parseJson, withPublicApi } from "@/server/http";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export const POST = withPublicApi<Context>(async (request, context) => {
  const id = z.uuid().parse((await context.params).id);
  const input = await parseJson(request, AuthScopeInputSchema);
  const scope = await authorizeAiAuth(request, input.setupToken);
  return json(await pollAuthAttempt(id, scope, { signal: request.signal }));
});

export const DELETE = withPublicApi<Context>(async (request, context) => {
  const id = z.uuid().parse((await context.params).id);
  const input = await parseJson(request, AuthScopeInputSchema);
  await cancelAuthAttempt(id, await authorizeAiAuth(request, input.setupToken));
  return json({ ok: true });
});
