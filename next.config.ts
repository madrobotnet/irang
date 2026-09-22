// Gate filename: src/proxy.ts
import type { NextConfig } from "next";

const securityHeaders = [
  { key: "Content-Security-Policy", value: "default-src 'self'; frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
] as const;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // 101mb sits above the 100MB upload gate so proxy truncation cannot turn an oversized body into a 500.
    proxyClientMaxBodySize: "101mb",
  },
  async headers() {
    return [{ source: "/:path*", headers: [...securityHeaders] }];
  },
};

export default nextConfig;
