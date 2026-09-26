const CSP_BASE =
  "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; connect-src 'self'";

export const CSP_NONCE_HEADER = "x-nonce";

/** Default CSP for JSON/API responses (no inline document scripts). */
export function buildContentSecurityPolicy(cspNonce?: string): string {
  const scriptSrc = cspNonce
    ? `script-src 'self' 'nonce-${cspNonce}' 'strict-dynamic'`
    : "script-src 'self'";
  return `${CSP_BASE}; ${scriptSrc}`;
}

export function generateCspNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

const STATIC_SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
};

/** API / redirect responses without App Router inline flight scripts. */
export const SECURITY_HEADERS: Record<string, string> = {
  ...STATIC_SECURITY_HEADERS,
  "Content-Security-Policy": buildContentSecurityPolicy(),
};

/** next.config static headers — CSP is set per-request in middleware (nonce for pages). */
export const SECURITY_HEADER_LIST = Object.entries(STATIC_SECURITY_HEADERS).map(
  ([key, value]) => ({ key, value }),
);

export function applySecurityHeaders(headers: Headers, options?: { cspNonce?: string }): void {
  for (const [key, value] of Object.entries(STATIC_SECURITY_HEADERS)) {
    headers.set(key, value);
  }
  headers.set("Content-Security-Policy", buildContentSecurityPolicy(options?.cspNonce));
}
