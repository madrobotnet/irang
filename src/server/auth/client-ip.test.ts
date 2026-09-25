import { describe, expect, it } from "vitest";
import { clientIpFromForwardedHeaders } from "./client-ip";

describe("clientIpFromForwardedHeaders", () => {
  it("uses X-Real-Ip for a single Traefik hop when XFF is spoofed", () => {
    expect(
      clientIpFromForwardedHeaders("203.0.113.50, 203.0.113.9", "203.0.113.9", 1),
    ).toBe("203.0.113.9");
    expect(clientIpFromForwardedHeaders("203.0.113.50", "203.0.113.9", 1)).toBe(
      "203.0.113.9",
    );
  });

  it("peels two trusted hops for Cloudflare + Traefik", () => {
    const xff = "198.18.0.1, 198.51.100.2, 203.0.113.7";
    expect(clientIpFromForwardedHeaders(xff, "203.0.113.7", 2)).toBe("198.18.0.1");
  });

  it("falls back to the rightmost XFF entry when the chain is shorter than hops", () => {
    expect(clientIpFromForwardedHeaders("203.0.113.4", null, 2)).toBe("203.0.113.4");
  });

  it("returns local when no forwarding headers are present", () => {
    expect(clientIpFromForwardedHeaders(null, null, 1)).toBe("local");
  });
});
