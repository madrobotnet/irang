import argon2 from "argon2";
import { cookies } from "next/headers";
import { z } from "zod";
import { clientIp } from "@/server/auth/client-ip";
import { passwordHash, SESSION_COOKIE } from "@/server/auth/config";
import { clearFailures, lockedForSeconds, recordFailure } from "@/server/auth/lockout";
import { createSession } from "@/server/auth/session";
import { ApiError, json, parseJson, withPublicApi } from "@/server/http";

const Body = z.object({ password: z.string().min(1).max(512) });

export const POST = withPublicApi(async (request) => {
  const hash = passwordHash();
  if (!hash) throw new ApiError("unavailable", "AUTH_PASSWORD_HASH is not configured");
  const { password } = await parseJson(request, Body);
  const ip = clientIp(request.headers);
  const clientKey = ip ?? "unknown";

  const locked = await lockedForSeconds(clientKey);
  if (locked > 0) {
    throw new ApiError("rate_limited", "Too many attempts", { retryAfterSeconds: locked });
  }
  const ok = await argon2.verify(hash, password).catch(() => false);
  if (!ok) {
    await recordFailure(clientKey);
    const nowLocked = await lockedForSeconds(clientKey);
    if (nowLocked > 0) throw new ApiError("rate_limited", "Too many attempts", { retryAfterSeconds: nowLocked });
    throw new ApiError("unauthorized", "Wrong password");
  }
  await clearFailures(clientKey);
  const session = await createSession({ passwordHash: hash, userAgent: request.headers.get("user-agent"), ip });
  const store = await cookies();
  store.set(SESSION_COOKIE, session.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1",
    path: "/",
    expires: session.expiresAt,
  });
  return json({ ok: true });
});
