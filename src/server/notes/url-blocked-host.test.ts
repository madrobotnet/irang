import { describe, expect, it } from "vitest";
import { isBlockedCaptureHost, isBlockedCaptureUrl } from "./url-blocked-host";

describe("isBlockedCaptureHost", () => {
  it("blocks loopback, link-local, RFC1918, and metadata names", () => {
    expect(isBlockedCaptureHost("127.0.0.1")).toBe(true);
    expect(isBlockedCaptureHost("10.0.0.5")).toBe(true);
    expect(isBlockedCaptureHost("172.16.0.1")).toBe(true);
    expect(isBlockedCaptureHost("192.168.1.2")).toBe(true);
    expect(isBlockedCaptureHost("169.254.169.254")).toBe(true);
    expect(isBlockedCaptureHost("localhost")).toBe(true);
    expect(isBlockedCaptureHost("metadata.google.internal")).toBe(true);
  });

  it("blocks IPv6 loopback, link-local, and ULA", () => {
    expect(isBlockedCaptureHost("::1")).toBe(true);
    expect(isBlockedCaptureHost("[::1]")).toBe(true);
    expect(isBlockedCaptureHost("fe80::1")).toBe(true);
    expect(isBlockedCaptureHost("fc00::1")).toBe(true);
    expect(isBlockedCaptureHost("::ffff:127.0.0.1")).toBe(true);
  });

  it("allows public hosts", () => {
    expect(isBlockedCaptureHost("example.com")).toBe(false);
    expect(isBlockedCaptureHost("93.184.216.34")).toBe(false);
    expect(isBlockedCaptureHost("2606:2800:220:1:248:1893:25c8:1946")).toBe(false);
  });
});

describe("isBlockedCaptureUrl", () => {
  it("evaluates the URL hostname", () => {
    expect(isBlockedCaptureUrl("https://127.0.0.1/secret")).toBe(true);
    expect(isBlockedCaptureUrl("https://example.com/article")).toBe(false);
  });
});
