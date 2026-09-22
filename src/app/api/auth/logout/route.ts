import type { NextRequest } from "next/server";
import { writeAudit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/client-ip";
import { readAuthConfig } from "@/lib/auth/config";
import { clearCookieHeader } from "@/lib/auth/cookies";
import { revokeByToken, SESSION_COOKIE } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const config = readAuthConfig();
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) await revokeByToken(token);
  await writeAudit("logout", clientIp(request.headers, null, config.trustProxy));
  return Response.json({ ok: true }, { headers: { "Set-Cookie": clearCookieHeader(config.cookieSecure) } });
}
