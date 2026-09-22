import { fail as assertNever } from "node:assert/strict";
import { z } from "zod";
import { writeAudit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/client-ip";
import { AuthMisconfiguredError, readAuthConfig } from "@/lib/auth/config";
import { cookieHeader } from "@/lib/auth/cookies";
import { clearFailures, lockStatus, recordFailure } from "@/lib/auth/lockout";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";

const loginBody = z.object({ password: z.string() }).readonly();

export async function POST(request: Request) {
  try {
    const config = readAuthConfig();
    const ip = clientIp(request.headers, null, config.trustProxy);
    const lock = await lockStatus(ip);
    switch (lock.locked) {
      case true:
        return Response.json({ error: "locked", retryAt: lock.lockedUntil.toISOString() }, { status: 423 });
      case false:
        break;
      default:
        assertNever(lock satisfies never);
    }
    const raw: unknown = await request.json().catch((error: unknown) => {
      if (error instanceof SyntaxError) return null;
      throw error;
    });
    const input = loginBody.safeParse(raw).data;
    if (input === undefined) return Response.json({ error: "invalid_request" }, { status: 400 });

    const encoded = await hashPassword(config.gatePassword);
    if (!await verifyPassword(input.password, encoded)) {
      await recordFailure(ip);
      await writeAudit("login_failure", ip);
      return Response.json({ error: "invalid_credentials" }, { status: 401 });
    }
    await clearFailures(ip);
    const session = await createSession({ ip, userAgent: request.headers.get("user-agent") });
    await writeAudit("login_success", ip);
    return Response.json({ ok: true }, { headers: { "Set-Cookie": cookieHeader(session.token, config.cookieSecure) } });
  } catch (error) {
    if (error instanceof AuthMisconfiguredError) {
      return Response.json({ error: "auth_misconfigured" }, { status: 503 });
    }
    throw error;
  }
}
