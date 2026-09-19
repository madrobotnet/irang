import type { NextConfig } from "next";
import { SECURITY_HEADER_LIST } from "./src/lib/auth/security-headers";
import { ATTACHMENT_MAX_REQUEST_BODY_BYTES } from "./src/domain/notes/attachment-request-limit";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["argon2", "pg"],
  experimental: {
    // Default 10MB truncates multipart uploads before the attachment handler runs (E2-U3).
    middlewareClientMaxBodySize: ATTACHMENT_MAX_REQUEST_BODY_BYTES,
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
