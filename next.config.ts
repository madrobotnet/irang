import type { NextConfig } from "next";
import { SECURITY_HEADER_LIST } from "./src/lib/auth/security-headers";
import { ATTACHMENT_UPLOAD_BODY_SIZE_LIMIT } from "./src/domain/notes/attachment-platform-limit";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["argon2", "pg"],
  experimental: {
    // Next 15 name for the proxy body cap (Next 16: proxyClientMaxBodySize). 102mb >= 101mb.
    middlewareClientMaxBodySize: ATTACHMENT_UPLOAD_BODY_SIZE_LIMIT,
  },
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
