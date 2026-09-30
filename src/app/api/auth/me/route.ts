import { getSession } from "@/server/auth/session";
import { json, withApi } from "@/server/http";

export const GET = withApi(async () => {
  const session = await getSession();
  return json({ ok: true, expiresAt: session?.expiresAt ?? null });
});
