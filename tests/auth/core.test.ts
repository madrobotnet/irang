import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { afterEach, describe, it } from "node:test";
import { hashPassword, verifyPassword } from "../../src/lib/auth/password";
import { AuthMisconfiguredError, readAuthConfig } from "../../src/lib/auth/config";
import { clientIp } from "../../src/lib/auth/client-ip";
import { cookieHeader, clearCookieHeader } from "../../src/lib/auth/cookies";
import { decideAccess } from "../../src/lib/auth/guard";

const originalEnv = { ...process.env };
afterEach(() => {
  for (const key of ["BRAIN_GATE_PASSWORD", "BRAIN_COOKIE_SECURE", "BRAIN_TRUST_PROXY"]) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("password hashing", () => {
  it("verifies the original password when hashed with argon2id", async () => {
    // Given
    const plain = randomBytes(32).toString("hex");
    // When
    const encoded = await hashPassword(plain);
    // Then: the prefix is the machine-consumed PHC algorithm identifier.
    assert.equal(encoded.startsWith("$argon2id$"), true);
    assert.equal(await verifyPassword(plain, encoded), true);
    assert.equal(await verifyPassword(`${plain}x`, encoded), false);
  });

  it("uses independent salts when the same password is hashed twice", async () => {
    // Given
    const plain = randomBytes(32).toString("hex");
    const first = await hashPassword(plain);
    // When
    const second = await hashPassword(plain);
    // Then
    assert.equal(first === second, false);
  });
});

describe("auth config", () => {
  for (const value of [undefined, "", " \t\n"]) {
    it(`rejects a ${value === undefined ? "missing" : value.length === 0 ? "empty" : "blank"} gate password`, () => {
      // Given
      if (value === undefined) delete process.env["BRAIN_GATE_PASSWORD"];
      else process.env["BRAIN_GATE_PASSWORD"] = value;
      // When / Then
      assert.throws(readAuthConfig, AuthMisconfiguredError);
    });
  }

  it("preserves a nonblank password when reading explicit boolean flags", () => {
    // Given
    const plain = ` ${randomBytes(32).toString("hex")} `;
    process.env["BRAIN_GATE_PASSWORD"] = plain;
    process.env["BRAIN_COOKIE_SECURE"] = "false";
    process.env["BRAIN_TRUST_PROXY"] = "true";
    // When
    const config = readAuthConfig();
    // Then
    assert.equal(config.gatePassword === plain, true);
    assert.equal(config.cookieSecure, false);
    assert.equal(config.trustProxy, true);
  });

  it("defaults to secure cookies without proxy trust when flags are absent", () => {
    // Given
    process.env["BRAIN_GATE_PASSWORD"] = randomBytes(32).toString("hex");
    delete process.env["BRAIN_COOKIE_SECURE"];
    delete process.env["BRAIN_TRUST_PROXY"];
    // When
    const config = readAuthConfig();
    // Then
    assert.equal(config.cookieSecure, true);
    assert.equal(config.trustProxy, false);
  });

  it("rejects invalid boolean configuration when a flag is misspelled", () => {
    // Given
    process.env["BRAIN_GATE_PASSWORD"] = randomBytes(32).toString("hex");
    process.env["BRAIN_TRUST_PROXY"] = "tru";
    // When / Then
    assert.throws(readAuthConfig, AuthMisconfiguredError);
  });
});

describe("client IP", () => {
  for (const trustProxy of [false, true]) {
    it(`uses ${trustProxy ? "the first proxy hop" : "the peer address"} when proxy trust is ${trustProxy}`, () => {
      // Given
      const headers = new Headers({ "X-Forwarded-For": " 203.0.113.4, 198.51.100.9 " });
      // When
      const ip = clientIp(headers, "192.0.2.1", trustProxy);
      // Then
      assert.equal(ip, trustProxy ? "203.0.113.4" : "192.0.2.1");
    });
  }
  it("uses the peer address when a trusted proxy provides no forwarded address", () => {
    // Given
    const headers = new Headers();
    // When
    const ip = clientIp(headers, "192.0.2.1", true);
    // Then
    assert.equal(ip, "192.0.2.1");
  });
});

describe("session cookies", () => {
  for (const secure of [true, false]) {
    it(`sets host-only cookie attributes when secure is ${secure}`, () => {
      // Given
      const token = randomBytes(32).toString("hex");
      // When
      const parts = cookieHeader(token, secure).split("; ");
      // Then: compare secrets only as booleans so failures cannot print them.
      assert.equal(parts.shift() === `brain_session=${token}`, true);
      assert.deepEqual(parts.sort(), ["HttpOnly", "Path=/", "SameSite=Lax", "Max-Age=604800", ...(secure ? ["Secure"] : [])].sort());
    });
    it(`expires the host-only cookie when secure is ${secure}`, () => {
      // Given / When
      const parts = clearCookieHeader(secure).split("; ");
      // Then
      assert.equal(parts.shift(), "brain_session=");
      assert.deepEqual(parts.sort(), ["HttpOnly", "Path=/", "SameSite=Lax", "Max-Age=0", ...(secure ? ["Secure"] : [])].sort());
    });
  }
});

describe("access guard", () => {
  it("redirects home to login when a forged session is invalid", () => {
    // Given
    const request = { pathname: "/", hasValidSession: false };
    // When
    const decision = decideAccess(request);
    // Then
    assert.equal(decision, "redirect_login");
  });
  for (const pathname of ["/login", "/api/auth/login", "/_next/static/app.js", "/favicon.ico", "/icons/icon.png", "/manifest.webmanifest"]) {
    it(`allows ${pathname} when unauthenticated`, () => {
      // Given / When
      const decision = decideAccess({ pathname, hasValidSession: false });
      // Then
      assert.equal(decision, "allow");
    });
  }
  for (const pathname of ["/api", "/api/auth/sessions", "/api/auth/logout", "/api/auth/login/extra"]) {
    it(`returns unauthorized for ${pathname} when unauthenticated`, () => {
      // Given / When
      const decision = decideAccess({ pathname, hasValidSession: false });
      // Then
      assert.equal(decision, "unauthorized");
    });
  }
  it("protects lookalike login paths when unauthenticated", () => {
    // Given / When
    const decision = decideAccess({ pathname: "/login/extra", hasValidSession: false });
    // Then
    assert.equal(decision, "redirect_login");
  });
  for (const pathname of ["/", "/api/auth/sessions"]) {
    it(`allows ${pathname} when the session is valid`, () => {
      // Given / When
      const decision = decideAccess({ pathname, hasValidSession: true });
      // Then
      assert.equal(decision, "allow");
    });
  }
});
