import { AiSettingsInputSchema } from "@/lib/ai-settings";
import { authConnections } from "@/server/chat/connection";
import { json, parseJson, withApi } from "@/server/http";
import { aiSettingsView, saveAiSettings } from "@/server/setup/settings";
import { authBrowserHash } from "@/server/ai-auth/access";

export const runtime = "nodejs";

export const GET = withApi(async () => {
  const [settings, connections] = await Promise.all([aiSettingsView(), authConnections()]);
  return json({ settings, connections });
});

export const PUT = withApi(async (request) => {
  await saveAiSettings(await parseJson(request, AiSettingsInputSchema), { browserHash: authBrowserHash(request) });
  const [settings, connections] = await Promise.all([aiSettingsView(), authConnections()]);
  return json({ settings, connections });
});
