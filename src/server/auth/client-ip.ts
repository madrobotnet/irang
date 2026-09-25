/**
 * Client IP for lockout keys behind Traefik and/or Cloudflare.
 *
 * With one trusted hop (Traefik only), prefer X-Real-Ip (socket peer Traefik saw).
 * With two or more hops (e.g. Cloudflare + Traefik), peel trusted proxy entries from
 * the right of X-Forwarded-For and take the client entry to the left of that peel.
 */

const DEFAULT_TRUSTED_PROXY_HOPS = 1;

function positiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function trustedProxyHopsFromEnv(env: NodeJS.ProcessEnv = process.env): number {
  return positiveInt(env.TRUSTED_PROXY_HOPS, DEFAULT_TRUSTED_PROXY_HOPS);
}

function parseForwardedList(forwarded: string): string[] {
  return forwarded
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function clientIpFromForwardedHeaders(
  forwarded: string | null,
  realIp: string | null,
  trustedHops: number,
): string {
  const hops = Math.max(1, trustedHops);
  const real = realIp?.trim();

  if (hops === 1 && real) {
    return real;
  }

  if (forwarded) {
    const parts = parseForwardedList(forwarded);
    if (parts.length > hops) {
      const clientIndex = parts.length - hops - 1;
      return parts[clientIndex]!;
    }
    if (parts.length === 1) {
      return parts[0]!;
    }
  }

  if (real) {
    return real;
  }

  if (forwarded) {
    const parts = parseForwardedList(forwarded);
    if (parts.length > 0) {
      return parts[parts.length - 1]!;
    }
  }

  return "local";
}

export function clientKeyFromForwardedHeaders(
  forwarded: string | null,
  realIp: string | null,
  trustedHops: number = trustedProxyHopsFromEnv(),
): string {
  return clientIpFromForwardedHeaders(forwarded, realIp, trustedHops);
}
