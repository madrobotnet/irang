import { describe, expect, it } from "vitest";
import { E2_PROTECTED_API_ROUTES, E2_PROTECTED_PAGE_ROUTES } from "./e2-gate-paths";
import {
  E3_PROTECTED_API_ROUTES,
  E3_PROTECTED_PAGE_ROUTES,
  e3InboxDiscardPath,
  e3InboxPromotePath,
} from "./e3-gate-paths";
import { E4_PROTECTED_API_ROUTES, E4_PROTECTED_PAGE_ROUTES } from "./e4-gate-paths";
import {
  E5_PROTECTED_API_ROUTES,
  E5_PROTECTED_PAGE_ROUTES,
  e5ChatMessagesPath,
  e5ChatProposeEditPath,
  e5ChatThreadPath,
} from "./e5-gate-paths";
import {
  E6_GATED_PATHS,
  E6_HOME_SUMMARY_PATH,
  E6_PROTECTED_API_ROUTES,
  E6_PROTECTED_PAGE_ROUTES,
  E6_PUBLIC_PWA_PATHS,
} from "./e6-gate-paths";
import { E7_PROTECTED_API_ROUTES, E7_PROTECTED_PAGE_ROUTES } from "./e7-gate-paths";
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

  it("lists inbox page and inbox APIs on the E3 gate", () => {
    expect([...E3_PROTECTED_PAGE_ROUTES]).toEqual(["/inbox"]);
    expect([...E3_PROTECTED_API_ROUTES]).toEqual([
      "/api/inbox",
      "/api/inbox/item-id/promote",
      "/api/inbox/item-id/discard",
    ]);
  });

  it("does not treat E3 inbox APIs as public", () => {
    for (const pathname of E3_PROTECTED_API_ROUTES) {
      expect(isPublicPath(pathname)).toBe(false);
      expect(decideAuthGate({ pathname, hasValidSessionToken: false })).toEqual({
        action: "unauthorized",
      });
      expect(decideAuthGate({ pathname, hasValidSessionToken: true }).action).toBe("next");
    }
  });

  it("matches Rex inbox route handlers on the gated paths", async () => {
    const collection = await import("@/app/api/inbox/route");
    const promote = await import("@/app/api/inbox/[id]/promote/route");
    const discard = await import("@/app/api/inbox/[id]/discard/route");
    expect(typeof collection.GET).toBe("function");
    expect(typeof collection.POST).toBe("function");
    expect(typeof promote.POST).toBe("function");
    expect("GET" in promote).toBe(false);
    expect(typeof discard.POST).toBe("function");
    expect("GET" in discard).toBe(false);
    expect(e3InboxPromotePath("item-id")).toBe("/api/inbox/item-id/promote");
    expect(e3InboxDiscardPath("item-id")).toBe("/api/inbox/item-id/discard");
    expect(E3_PROTECTED_API_ROUTES).toContain(e3InboxPromotePath("item-id"));
    expect(E3_PROTECTED_API_ROUTES).toContain(e3InboxDiscardPath("item-id"));
  });

  it("redirects unauthenticated inbox page to login", () => {
    for (const pathname of E3_PROTECTED_PAGE_ROUTES) {
      expect(isPublicPath(pathname)).toBe(false);
      expect(decideAuthGate({ pathname, hasValidSessionToken: false })).toEqual({
        action: "redirect_login",
      });
      expect(decideAuthGate({ pathname, hasValidSessionToken: true }).action).toBe("next");
    }
  });

  it("lists the search page and Rex search APIs on the E4 gate", () => {
    expect([...E4_PROTECTED_PAGE_ROUTES]).toEqual(["/search"]);
    expect([...E4_PROTECTED_API_ROUTES]).toEqual(["/api/search", "/api/search/evidence"]);
  });

  it("matches Rex search route handlers on the gated paths", async () => {
    const search = await import("@/app/api/search/route");
    const evidence = await import("@/app/api/search/evidence/route");
    expect(typeof search.GET).toBe("function");
    expect(typeof search.POST).toBe("function");
    expect(typeof evidence.GET).toBe("function");
    expect(typeof evidence.POST).toBe("function");
  });

  it("does not treat E4 search APIs as public", () => {
    for (const pathname of E4_PROTECTED_API_ROUTES) {
      expect(isPublicPath(pathname)).toBe(false);
      expect(decideAuthGate({ pathname, hasValidSessionToken: false })).toEqual({
        action: "unauthorized",
      });
      expect(decideAuthGate({ pathname, hasValidSessionToken: true }).action).toBe("next");
    }
  });

  it("redirects unauthenticated search page to login", () => {
    for (const pathname of E4_PROTECTED_PAGE_ROUTES) {
      expect(isPublicPath(pathname)).toBe(false);
      expect(decideAuthGate({ pathname, hasValidSessionToken: false })).toEqual({
        action: "redirect_login",
      });
      expect(decideAuthGate({ pathname, hasValidSessionToken: true }).action).toBe("next");
    }
  });

  it("lists the chat page and chat API placeholders on the E5 gate", () => {
    expect([...E5_PROTECTED_PAGE_ROUTES]).toEqual(["/chat"]);
    expect([...E5_PROTECTED_API_ROUTES]).toEqual([
      "/api/chat",
      "/api/chat/thread-id",
      "/api/chat/thread-id/messages",
      "/api/chat/thread-id/propose-edit",
    ]);
    expect(e5ChatThreadPath("thread-id")).toBe("/api/chat/thread-id");
    expect(e5ChatMessagesPath("thread-id")).toBe("/api/chat/thread-id/messages");
    expect(e5ChatProposeEditPath("thread-id")).toBe("/api/chat/thread-id/propose-edit");
  });

  it("does not treat E5 chat APIs as public", () => {
    for (const pathname of E5_PROTECTED_API_ROUTES) {
      expect(isPublicPath(pathname)).toBe(false);
      expect(decideAuthGate({ pathname, hasValidSessionToken: false })).toEqual({
        action: "unauthorized",
      });
      expect(decideAuthGate({ pathname, hasValidSessionToken: true }).action).toBe("next");
    }
  });

  it("redirects unauthenticated chat page to login", () => {
    for (const pathname of E5_PROTECTED_PAGE_ROUTES) {
      expect(isPublicPath(pathname)).toBe(false);
      expect(decideAuthGate({ pathname, hasValidSessionToken: false })).toEqual({
        action: "redirect_login",
      });
      expect(decideAuthGate({ pathname, hasValidSessionToken: true }).action).toBe("next");
    }
  });

  it("lists the home page and home summary API on the E6 gate", () => {
    expect([...E6_PROTECTED_PAGE_ROUTES]).toEqual(["/"]);
    expect([...E6_PROTECTED_API_ROUTES]).toEqual(["/api/home"]);
    expect(E6_HOME_SUMMARY_PATH).toBe("/api/home");
    expect([...E6_GATED_PATHS]).toEqual(["/", "/api/home"]);
    expect([...E6_PUBLIC_PWA_PATHS]).toEqual([
      "/manifest.webmanifest",
      "/icons/icon-192.png",
      "/icons/icon-512.png",
      "/icons/icon-48.png",
    ]);
  });

  it("does not treat the E6 home summary API as public", () => {
    for (const pathname of E6_PROTECTED_API_ROUTES) {
      expect(isPublicPath(pathname)).toBe(false);
      expect(decideAuthGate({ pathname, hasValidSessionToken: false })).toEqual({
        action: "unauthorized",
      });
      expect(decideAuthGate({ pathname, hasValidSessionToken: true }).action).toBe("next");
    }
  });

  it("redirects an unauthenticated home page to login", () => {
    for (const pathname of E6_PROTECTED_PAGE_ROUTES) {
      expect(isPublicPath(pathname)).toBe(false);
      expect(decideAuthGate({ pathname, hasValidSessionToken: false })).toEqual({
        action: "redirect_login",
      });
      expect(decideAuthGate({ pathname, hasValidSessionToken: true }).action).toBe("next");
    }
  });

  it("does not treat E7 graph APIs as public", () => {
    for (const pathname of E7_PROTECTED_API_ROUTES) {
      expect(isPublicPath(pathname)).toBe(false);
      expect(decideAuthGate({ pathname, hasValidSessionToken: false })).toEqual({
        action: "unauthorized",
      });
      expect(decideAuthGate({ pathname, hasValidSessionToken: true }).action).toBe("next");
    }
  });

  it("redirects an unauthenticated graph page to login", () => {
    for (const pathname of E7_PROTECTED_PAGE_ROUTES) {
      expect(isPublicPath(pathname)).toBe(false);
      expect(decideAuthGate({ pathname, hasValidSessionToken: false })).toEqual({
        action: "redirect_login",
      });
      expect(decideAuthGate({ pathname, hasValidSessionToken: true }).action).toBe("next");
    }
  });

  it("leaves the web manifest and home-screen icons public", () => {
    for (const pathname of E6_PUBLIC_PWA_PATHS) {
      expect(E6_GATED_PATHS).not.toContain(pathname);
      expect(isPublicPath(pathname)).toBe(true);
      expect(decideAuthGate({ pathname, hasValidSessionToken: false })).toEqual({
        action: "next",
      });
    }
  });
});
