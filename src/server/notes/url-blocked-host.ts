/**
 * Hostnames and IPs that must not be fetched for URL capture (SSRF guard).
 * Checked on the requested URL and again on the post-redirect final URL.
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata",
  "metadata.google.internal",
  "metadata.google",
  "instance-data",
]);

function normalizeHostname(hostname: string): string {
  const lower = hostname.trim().toLowerCase();
  if (lower.startsWith("[") && lower.endsWith("]")) {
    return lower.slice(1, -1);
  }
  return lower;
}

function parseIpv4Octets(host: string): number[] | null {
  const parts = host.split(".");
  if (parts.length !== 4) {
    return null;
  }
  const octets: number[] = [];
  for (const part of parts) {
    if (part === "" || !/^\d+$/.test(part)) {
      return null;
    }
    const value = Number(part);
    if (value > 255) {
      return null;
    }
    octets.push(value);
  }
  return octets;
}

function isBlockedIpv4(host: string): boolean {
  const octets = parseIpv4Octets(host);
  if (octets === null) {
    return false;
  }
  const [a, b] = octets;
  if (a === 0) {
    return true;
  }
  if (a === 10) {
    return true;
  }
  if (a === 127) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  if (a === 100 && b >= 64 && b <= 127) {
    return true;
  }
  return false;
}

function expandIpv6Hextets(host: string): string[] | null {
  const lower = host.toLowerCase();
  if (!/^[0-9a-f:]+$/.test(lower)) {
    return null;
  }
  const [head, tail] = lower.split("::");
  const headParts = head ? head.split(":").filter(Boolean) : [];
  const tailParts = tail !== undefined ? tail.split(":").filter(Boolean) : [];
  if (tail === undefined && headParts.length !== 8) {
    return null;
  }
  const missing = 8 - headParts.length - tailParts.length;
  if (missing < 0) {
    return null;
  }
  if (tail === undefined && missing !== 0) {
    return null;
  }
  return [...headParts, ...Array.from({ length: missing }, () => "0"), ...tailParts];
}

function ipv6HextetValue(part: string): number | null {
  if (!/^[0-9a-f]{1,4}$/i.test(part)) {
    return null;
  }
  return Number.parseInt(part, 16);
}

function isBlockedIpv6(host: string): boolean {
  if (host.includes(".")) {
    const mapped = host.match(/^::ffff:(.+)$/i);
    if (mapped) {
      return isBlockedIpv4(mapped[1]!);
    }
    return false;
  }
  const hextets = expandIpv6Hextets(host);
  if (hextets === null || hextets.length !== 8) {
    return false;
  }
  const values = hextets.map(ipv6HextetValue);
  if (values.some((v) => v === null)) {
    return false;
  }
  const nums = values as number[];
  if (nums.every((n) => n === 0)) {
    return true;
  }
  if (nums[7] === 1 && nums.slice(0, 7).every((n) => n === 0)) {
    return true;
  }
  if ((nums[0] & 0xffc0) === 0xfe80) {
    return true;
  }
  if ((nums[0] & 0xfe00) === 0xfc00) {
    return true;
  }
  if (nums[0] === 0x2001 && nums[1] === 0xdb8) {
    return true;
  }
  return false;
}

export function isBlockedCaptureHost(hostname: string): boolean {
  const host = normalizeHostname(hostname);
  if (!host) {
    return true;
  }
  if (BLOCKED_HOSTNAMES.has(host)) {
    return true;
  }
  if (host.endsWith(".localhost") || host.endsWith(".local")) {
    return true;
  }
  if (host.includes(":")) {
    return isBlockedIpv6(host);
  }
  if (parseIpv4Octets(host) !== null) {
    return isBlockedIpv4(host);
  }
  return false;
}

export function isBlockedCaptureUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return isBlockedCaptureHost(parsed.hostname);
  } catch {
    return true;
  }
}
