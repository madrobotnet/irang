import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/server/auth/config";
import { revokeToken } from "@/server/auth/session";
import { json, withPublicApi } from "@/server/http";

export const POST = withPublicApi(async () => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await revokeToken(token);
  store.delete(SESSION_COOKIE);
  return json({ ok: true });
});
