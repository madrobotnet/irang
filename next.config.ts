import type { NextConfig } from "next";
import { SECURITY_HEADER_LIST } from "./src/lib/auth/security-headers";
import { ATTACHMENT_UPLOAD_BODY_SIZE_LIMIT } from "./src/domain/notes/attachment-platform-limit";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["argon2", "pg"],
  experimental: {
    // App Router multipart envelope for POST /api/attachments (Next default ~10MB).
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
