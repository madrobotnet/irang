import { SESSION_TTL_SECONDS } from "./constants";
import type { SessionCookieAttributes } from "./types";

export function sessionCookieAttributes(): SessionCookieAttributes {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAgeSeconds: SESSION_TTL_SECONDS,
  };
}

export function clearedSessionCookieAttributes(): SessionCookieAttributes {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAgeSeconds: 0,
  };
}
