import { json, parseJson, withPublicApi } from "@/server/http";
import { completeSetup, SetupInputSchema } from "@/server/setup/service";

export const runtime = "nodejs";

export const POST = withPublicApi(async (request) => {
  const input = await parseJson(request, SetupInputSchema);
  await completeSetup(input);
  return json({ ok: true }, { status: 201 });
});
