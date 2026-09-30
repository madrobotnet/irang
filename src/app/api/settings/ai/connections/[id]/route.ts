import { z } from "zod";
import { ConnectionProfileInputSchema } from "@/lib/ai-settings";
import { authBrowserHash } from "@/server/ai-auth/access";
import { json, parseJson, withApi } from "@/server/http";
import { deleteConnectionProfile, saveConnectionProfile } from "@/server/setup/ai-profiles";
import { profileView } from "@/server/setup/ai-profile-store";
import { aiSettingsView } from "@/server/setup/settings";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export const PUT = withApi<Context>(async (request, context) => {
  const id = z.uuid().parse((await context.params).id);
  const profile = await saveConnectionProfile(await parseJson(request, ConnectionProfileInputSchema), {
    id, browserHash: authBrowserHash(request),
  });
  return json({ profile: profileView(profile), settings: await aiSettingsView() });
});

export const DELETE = withApi<Context>(async (_request, context) => {
  await deleteConnectionProfile(z.uuid().parse((await context.params).id));
  return json({ settings: await aiSettingsView() });
});
