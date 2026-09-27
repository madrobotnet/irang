import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["argon2", "pg"],
  experimental: {
    // Attachment uploads up to 25 MB pass through the proxy.
    proxyClientMaxBodySize: "26mb",
  },
};

export default nextConfig;
