import { describe, expect, it } from "vitest";
import {
  SECURITY_HEADERS,
  SECURITY_HEADER_LIST,
  applySecurityHeaders,
  buildContentSecurityPolicy,
} from "./security-headers";

describe("security headers", () => {
  it("includes HSTS, CSP, X-Content-Type-Options, Referrer-Policy, and XFO", () => {
    expect(SECURITY_HEADERS["Strict-Transport-Security"]).toMatch(/max-age=/);
    expect(SECURITY_HEADERS["Content-Security-Policy"]).toMatch(/frame-ancestors 'none'/);
    expect(SECURITY_HEADERS["X-Content-Type-Options"]).toBe("nosniff");
    expect(SECURITY_HEADERS["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(SECURITY_HEADERS["X-Frame-Options"]).toBe("DENY");
  });

  it("does not allow unsafe-inline scripts on the default API CSP", () => {
    const csp = SECURITY_HEADERS["Content-Security-Policy"];
    expect(csp).toMatch(/script-src 'self'/);
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(csp).not.toContain("'strict-dynamic'");
    expect(csp).not.toMatch(/'nonce-/);
  });

  it("SECURITY_HEADER_LIST omits CSP (no static script-src lock via next.config)", () => {
    expect(SECURITY_HEADER_LIST.some((entry) => entry.key === "Content-Security-Policy")).toBe(
      false,
    );
  });

  it("document CSP uses nonce strict-dynamic instead of the pre-fix self-only script lock", () => {
    const apiOnly = buildContentSecurityPolicy();
    const document = buildContentSecurityPolicy("flight-nonce");
    expect(document).not.toBe(apiOnly);
    expect(document).toMatch(/script-src 'self' 'nonce-flight-nonce' 'strict-dynamic'/);
    expect(apiOnly).toMatch(/script-src 'self';?$/);
  });

  it("builds nonce CSP for App Router flight scripts", () => {
    const csp = buildContentSecurityPolicy("abc123");
    expect(csp).toMatch(/script-src 'self' 'nonce-abc123' 'strict-dynamic'/);
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
  });

  it("applySecurityHeaders uses nonce strict-dynamic for documents (not script unsafe-inline)", () => {
    const headers = new Headers();
    applySecurityHeaders(headers, { cspNonce: "flight-nonce" });
    const csp = headers.get("Content-Security-Policy") ?? "";
    expect(csp).toBe(buildContentSecurityPolicy("flight-nonce"));
    expect(csp).toContain("'nonce-flight-nonce'");
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
  });
});
