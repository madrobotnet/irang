export function isPublicPath(pathname: string): boolean {
  if (pathname === "/login" || pathname.startsWith("/login/")) {
    return true;
  }
  if (pathname === "/api/auth/login" || pathname.startsWith("/api/auth/login/")) {
    return true;
  }
  if (pathname === "/api/health" || pathname.startsWith("/api/health/")) {
    return true;
  }
  if (pathname === "/api/auth/logout" || pathname.startsWith("/api/auth/logout/")) {
    return true;
  }
  if (pathname === "/api/auth/me" || pathname.startsWith("/api/auth/me/")) {
    return true;
  }
  if (pathname === "/api/session" || pathname.startsWith("/api/session/")) {
    return true;
  }
  if (pathname.startsWith("/_next/")) {
    return true;
  }
  if (pathname === "/favicon.ico") {
    return true;
  }
  return false;
}

export function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

export type GateDecision =
  | { action: "next" }
  | { action: "redirect_login" }
  | { action: "unauthorized" };

export function decideAuthGate(args: {
  pathname: string;
  hasValidSessionToken: boolean;
}): GateDecision {
  if (isPublicPath(args.pathname) || args.hasValidSessionToken) {
    return { action: "next" };
  }
  if (isApiPath(args.pathname)) {
    return { action: "unauthorized" };
  }
  return { action: "redirect_login" };
}
