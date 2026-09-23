import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const checklist = readFileSync(path.join(process.cwd(), "docs/SECURITY.md"), "utf8");

describe("docs/SECURITY.md deploy checklist", () => {
  it("covers cookie, TLS, and env without a hardcoded domain or a Traefik service", () => {
    expect(checklist).toMatch(/sb_session/);
    expect(checklist).toMatch(/HttpOnly/);
    expect(checklist).toMatch(/Secure/);
    expect(checklist).toMatch(/SameSite=Lax/);
    expect(checklist).toMatch(/AUTH_PASSWORD_HASH/);
    expect(checklist).toMatch(/DATABASE_URL/);
    expect(checklist).toMatch(/TYPESAFE_API_KEY/);
    expect(checklist).toMatch(/HTTPS/);
    expect(checklist).toMatch(/Oak/);
    expect(checklist).not.toMatch(/madrobot\.net/i);
    expect(checklist).not.toMatch(/traefik:/i);
    expect(checklist).toMatch(/\b429\b/);
    expect(checklist).not.toMatch(/\b423\b/);
  });
});
