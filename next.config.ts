import type { NextConfig } from "next";
import { SECURITY_HEADER_LIST } from "./src/lib/auth/security-headers";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["argon2", "pg"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADER_LIST,
      },
    ];
  },
};

export default nextConfig;
