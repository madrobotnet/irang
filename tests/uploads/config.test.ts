import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import nextConfig from "../../next.config";

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: "default-src 'self'; frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
] as const;

it("raises the proxy body limit without dropping security headers", async () => {
  // Given / When
  const headers = nextConfig.headers;
  if (headers === undefined) assert.fail("security headers are not configured");
  const rules = await headers();
  // Then
  assert.equal(nextConfig.experimental?.proxyClientMaxBodySize, "101mb");
  const rule = rules[0];
  assert.ok(rule);
  assert.equal(rule.source, "/:path*");
  assert.deepEqual(rule.headers, SECURITY_HEADERS);
});

it("ignores data/uploads", () => {
  // Given / When
  const lines = readFileSync(new URL("../../.gitignore", import.meta.url), "utf8").split("\n");
  // Then
  assert.equal(lines.includes("data/uploads"), true);
});
