/** Client IP from X-Forwarded-For, trusting TRUSTED_PROXY_HOPS proxies (default 1). */
export function clientIp(headers: Headers): string | null {
  const hops = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS) || 1);
  const chain = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const candidate = chain.length >= hops ? chain[chain.length - hops] : (chain[0] ?? headers.get("x-real-ip"));
  if (!candidate) return null;
  return /^[0-9a-fA-F:.]+$/.test(candidate) ? candidate : null;
}
