import { ConnectionProfileInputSchema } from "@/lib/ai-settings";
import { authBrowserHash } from "@/server/ai-auth/access";
import { json, parseJson, withApi } from "@/server/http";
import { saveConnectionProfile } from "@/server/setup/ai-profiles";
import { profileView } from "@/server/setup/ai-profile-store";
import { aiSettingsView } from "@/server/setup/settings";

export const runtime = "nodejs";

export const POST = withApi(async (request) => {
  const profile = await saveConnectionProfile(await parseJson(request, ConnectionProfileInputSchema), {
    browserHash: authBrowserHash(request),
  });
  return json({ profile: profileView(profile), settings: await aiSettingsView() }, { status: 201 });
});
