import { describe, expect, it } from "vitest";
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
});
