import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/server/auth/config";
import { revokeAllSessions } from "@/server/auth/session";
import { json, withApi } from "@/server/http";

export const POST = withApi(async () => {
  const revoked = await revokeAllSessions();
  (await cookies()).delete(SESSION_COOKIE);
  return json({ ok: true, revoked });
});
