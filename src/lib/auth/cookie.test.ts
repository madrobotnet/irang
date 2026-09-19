import { describe, expect, it } from "vitest";
import { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from "@/domain/auth/constants";
import { sessionCookieAttributes } from "@/domain/auth/cookie-policy";
import { setCookieHeader } from "./cookie";

describe("session cookie flags", () => {
  it("serializes HttpOnly + Secure + SameSite=Lax with a 7 day TTL", () => {
    const header = setCookieHeader("token-value", sessionCookieAttributes());
    expect(header.startsWith(`${SESSION_COOKIE_NAME}=`)).toBe(true);
    expect(header).toContain("HttpOnly");
    expect(header).toContain("Secure");
    expect(header).toContain("SameSite=Lax");
    expect(header).toContain(`Max-Age=${SESSION_TTL_SECONDS}`);
    expect(header).toContain("Path=/");
  });
});
