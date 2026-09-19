import { describe, expect, it } from "vitest";
import { E2_PROTECTED_API_ROUTES, E2_PROTECTED_PAGE_ROUTES } from "./e2-gate-paths";
import { decideAuthGate, isPublicPath } from "./gate";

describe("auth gate", () => {
  it("allows login, health, and logout without a session", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/api/auth/login")).toBe(true);
    expect(isPublicPath("/api/health")).toBe(true);
    expect(isPublicPath("/api/auth/logout")).toBe(true);
    expect(decideAuthGate({ pathname: "/login", hasValidSessionToken: false }).action).toBe(
      "next",
    );
  });

  it("redirects unauthenticated UI to login", () => {
    expect(decideAuthGate({ pathname: "/", hasValidSessionToken: false })).toEqual({
      action: "redirect_login",
    });
  });

  it("allows /api/auth/me through middleware; handler enforces session", () => {
    expect(isPublicPath("/api/auth/me")).toBe(true);
    expect(isPublicPath("/api/session")).toBe(true);
    expect(decideAuthGate({ pathname: "/api/auth/me", hasValidSessionToken: false }).action).toBe(
      "next",
    );
  });

  it("returns unauthorized for unauthenticated protected APIs", () => {
    expect(decideAuthGate({ pathname: "/api/notes", hasValidSessionToken: false })).toEqual({
      action: "unauthorized",
    });
  });

  it("allows authenticated protected routes", () => {
    expect(decideAuthGate({ pathname: "/api/notes", hasValidSessionToken: true }).action).toBe(
      "next",
    );
  });

  it("does not treat E2 note/capture APIs as public", () => {
    for (const pathname of E2_PROTECTED_API_ROUTES) {
      expect(isPublicPath(pathname)).toBe(false);
      expect(decideAuthGate({ pathname, hasValidSessionToken: false })).toEqual({
        action: "unauthorized",
      });
    }
  });

  it("redirects unauthenticated E2 pages to login", () => {
    for (const pathname of E2_PROTECTED_PAGE_ROUTES) {
      expect(decideAuthGate({ pathname, hasValidSessionToken: false })).toEqual({
        action: "redirect_login",
      });
    }
  });
});
