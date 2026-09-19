import { describe, expect, it } from "vitest";
import { mapLoginJsonResponse } from "./client-api";

const NOW = 1_700_000_000_000;

describe("mapLoginJsonResponse", () => {
  it("maps success by status", () => {
    expect(mapLoginJsonResponse(200, null, NOW)).toEqual({ kind: "success" });
  });

  it("maps canonical bad_password code to invalid_password UI", () => {
    expect(
      mapLoginJsonResponse(401, { code: "bad_password" }, NOW),
    ).toEqual({ kind: "invalid_password" });
  });

  it("prefers code invalid_password over status (transitional)", () => {
    expect(
      mapLoginJsonResponse(400, { code: "invalid_password" }, NOW),
    ).toEqual({ kind: "invalid_password" });
  });

  it("maps bad_password via legacy error field", () => {
    expect(
      mapLoginJsonResponse(401, { error: "bad_password" }, NOW),
    ).toEqual({ kind: "invalid_password" });
  });

  it("falls back to error field when code is missing", () => {
    expect(
      mapLoginJsonResponse(401, { error: "invalid_password" }, NOW),
    ).toEqual({ kind: "invalid_password" });
  });

  it("maps locked with retryAfterSeconds from code", () => {
    expect(
      mapLoginJsonResponse(
        429,
        { code: "locked", retryAfterSeconds: 90, message: "wait" },
        NOW,
      ),
    ).toEqual({
      kind: "locked",
      retryAfterSeconds: 90,
      message: "wait",
    });
  });

  it("prefers retryAfterSec over retryAfterSeconds", () => {
    expect(
      mapLoginJsonResponse(
        429,
        { code: "locked", retryAfterSec: 45, retryAfterSeconds: 90 },
        NOW,
      ),
    ).toEqual({ kind: "locked", retryAfterSeconds: 45 });
  });

  it("derives retry from unlockAt epoch seconds", () => {
    const unlockAt = NOW / 1000 + 120;
    expect(
      mapLoginJsonResponse(429, { code: "locked", unlockAt }, NOW),
    ).toEqual({ kind: "locked", retryAfterSeconds: 120 });
  });

  it("maps misconfigured by code and ops alias", () => {
    expect(
      mapLoginJsonResponse(503, { code: "misconfigured" }, NOW),
    ).toEqual({ kind: "misconfigured" });
    expect(mapLoginJsonResponse(503, { code: "ops" }, NOW)).toEqual({
      kind: "misconfigured",
    });
  });

  it("maps locked via legacy error field when code is absent", () => {
    expect(
      mapLoginJsonResponse(429, { error: "locked", retryAfterSeconds: 30 }, NOW),
    ).toEqual({ kind: "locked", retryAfterSeconds: 30 });
  });

  it("uses HTTP status fallback when body has no code or error", () => {
    expect(mapLoginJsonResponse(401, {}, NOW)).toEqual({
      kind: "invalid_password",
    });
    expect(mapLoginJsonResponse(429, {}, NOW)).toEqual({
      kind: "locked",
      retryAfterSeconds: 60,
    });
    expect(mapLoginJsonResponse(503, null, NOW)).toEqual({
      kind: "misconfigured",
    });
    expect(mapLoginJsonResponse(502, null, NOW)).toEqual({ kind: "network" });
  });
});
