import { SESSION_COOKIE_NAME } from "@/domain/auth/constants";
import type { SessionCookieAttributes } from "@/domain/auth/types";

export function parseCookieHeader(header: string | null): Record<string, string> {
  if (!header) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) {
      continue;
    }
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) {
      out[key] = decodeURIComponent(value);
    }
  }
  return out;
}

export function readSessionCookie(cookieHeader: string | null): string | null {
  const value = parseCookieHeader(cookieHeader)[SESSION_COOKIE_NAME];
  return value ? value : null;
}

export function serializeCookie(
  name: string,
  value: string,
  attrs: SessionCookieAttributes,
): string {
  const segments = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${attrs.path}`,
    `Max-Age=${attrs.maxAgeSeconds}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ];
  return segments.join("; ");
}

export function setCookieHeader(value: string, attrs: SessionCookieAttributes): string {
  return serializeCookie(SESSION_COOKIE_NAME, value, attrs);
}
