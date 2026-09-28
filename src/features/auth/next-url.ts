/**
 * The login page carries the original destination in `?next=`. Only same-origin
 * absolute paths survive; anything that could leave the site (protocol-relative
 * `//evil`, schemes, backslashes, control chars) or loop back to /login falls to "/".
 */
export function sanitizeNextUrl(raw: string | string[] | null | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return "/";
  const next = value.trim();
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  if (/[\u0000-\u001f\u007f]/.test(next) || next.includes("\\")) return "/";
  if (next === "/login" || next.startsWith("/login?") || next.startsWith("/login/")) return "/";
  if (next.startsWith("/api/")) return "/";
  return next;
}
