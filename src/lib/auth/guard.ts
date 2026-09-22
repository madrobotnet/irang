export type AccessDecision = "allow" | "redirect_login" | "unauthorized";

export function decideAccess({ pathname, hasValidSession }: {
  readonly pathname: string;
  readonly hasValidSession: boolean;
}): AccessDecision {
  if (hasValidSession || pathname === "/login" || pathname === "/api/auth/login") return "allow";
  if (["/_next", "/favicon.ico", "/icons", "/manifest.webmanifest"].some((prefix) => pathname.startsWith(prefix))) {
    return "allow";
  }
  return pathname === "/api" || pathname.startsWith("/api/") ? "unauthorized" : "redirect_login";
}
