import { describe, expect, it } from "vitest";
import { errorBody, lockedBody, meOkBody, unauthorizedBody } from "./api-contract";

describe("API auth contract envelopes", () => {
  it("unauthorized matches GET /me contract", () => {
    expect(unauthorizedBody()).toEqual({
      ok: false,
      authenticated: false,
      code: "unauthorized",
    });
  });

  it("error codes use ok:false + code", () => {
    expect(errorBody("bad_password")).toEqual({ ok: false, code: "bad_password" });
    expect(errorBody("validation")).toEqual({ ok: false, code: "validation" });
  });

  it("locked includes retryAfterSec, unlockAt, and Lio alias retryAfterSeconds", () => {
    const body = lockedBody({
      retryAfterSec: 900,
      unlockAt: "2026-09-20T12:00:00.000Z",
      message: "locked",
    });
    expect(body.code).toBe("locked");
    expect(body.retryAfterSec).toBe(900);
    expect(body.retryAfterSeconds).toBe(900);
    expect(body.unlockAt).toMatch(/Z$/);
  });

  it("me success includes session id and ISO timestamps", () => {
    const body = meOkBody({
      publicId: "00000000-0000-4000-8000-000000000099",
      createdAt: "2026-09-19T00:00:00.000Z",
      expiresAt: "2026-09-26T00:00:00.000Z",
    });
    expect(body.authenticated).toBe(true);
    expect(body.session.id).toBe("00000000-0000-4000-8000-000000000099");
  });
});
