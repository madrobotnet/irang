export function cookieHeader(token: string, secure: boolean): string {
  return `brain_session=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800${secure ? "; Secure" : ""}`;
}

export function clearCookieHeader(secure: boolean): string {
  return `brain_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
}
