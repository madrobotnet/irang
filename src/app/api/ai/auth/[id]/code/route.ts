import { z } from "zod";
import { AuthCodeInputSchema } from "@/lib/ai-auth-flow";
import { authorizeAiAuth } from "@/server/ai-auth/access";
import { submitAuthCode } from "@/server/ai-auth/code";
import { json, parseJson, withPublicApi } from "@/server/http";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export const POST = withPublicApi<Context>(async (request, context) => {
  const id = z.uuid().parse((await context.params).id);
  const input = await parseJson(request, AuthCodeInputSchema);
  const scope = await authorizeAiAuth(request, input.setupToken);
  return json(await submitAuthCode({ id, code: input.code }, scope, { signal: request.signal }));
});
