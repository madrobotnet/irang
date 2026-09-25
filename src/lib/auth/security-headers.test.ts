import { describe, expect, it } from "vitest";
import { SECURITY_HEADERS } from "./security-headers";

describe("security headers", () => {
  it("includes HSTS, CSP, X-Content-Type-Options, Referrer-Policy, and XFO", () => {
    expect(SECURITY_HEADERS["Strict-Transport-Security"]).toMatch(/max-age=/);
    expect(SECURITY_HEADERS["Content-Security-Policy"]).toMatch(/frame-ancestors 'none'/);
    expect(SECURITY_HEADERS["X-Content-Type-Options"]).toBe("nosniff");
    expect(SECURITY_HEADERS["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(SECURITY_HEADERS["X-Frame-Options"]).toBe("DENY");
  });

  it("does not allow unsafe-inline scripts", () => {
    const csp = SECURITY_HEADERS["Content-Security-Policy"];
    expect(csp).toMatch(/script-src 'self'/);
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
  });
});
