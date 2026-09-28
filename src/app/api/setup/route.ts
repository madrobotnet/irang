import { json, parseJson, withPublicApi } from "@/server/http";
import { completeSetup, SetupInputSchema } from "@/server/setup/service";
import { authBrowserHash } from "@/server/ai-auth/access";

export const runtime = "nodejs";

export const POST = withPublicApi(async (request) => {
  const input = await parseJson(request, SetupInputSchema);
  await completeSetup(input, { browserHash: authBrowserHash(request) });
  return json({ ok: true }, { status: 201 });
});
