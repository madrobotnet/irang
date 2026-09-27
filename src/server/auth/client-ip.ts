import { isIP } from "node:net";

/** Deployment must restrict app ingress to its configured reverse proxies. */
export function clientIp(headers: Headers): string | null {
  const hops = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS) || 1);
  const chain = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const candidate = chain.length >= hops ? chain[chain.length - hops] : (chain[0] ?? headers.get("x-real-ip"));
  if (!candidate) return null;
  return isIP(candidate) ? candidate : null;
}
