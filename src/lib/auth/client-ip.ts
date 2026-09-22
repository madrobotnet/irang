export function clientIp(headers: Headers, remoteAddress: string | null, trustProxy: boolean): string {
  if (trustProxy) {
    const firstHop = headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
    if (firstHop) return firstHop;
  }
  return remoteAddress || "unknown";
}
