import { describe, expect, it } from "vitest";
import { authInitFailureBody, authInitFailureCode } from "./init-response";
import { AuthStorageInitError } from "./init-errors";

describe("authInitFailure mapping", () => {
  it("maps invalid DATABASE_URL to misconfigured", () => {
    const error = new AuthStorageInitError("invalid_database_url", "bad url");
    expect(authInitFailureCode(error)).toBe("misconfigured");
    expect(authInitFailureBody(error)).toEqual({ ok: false, code: "misconfigured" });
  });

  it("maps storage failures to storage_unavailable", () => {
    const error = new AuthStorageInitError("storage_unavailable", "db down");
    expect(authInitFailureCode(error)).toBe("storage_unavailable");
    expect(authInitFailureBody(error)).toEqual({ ok: false, code: "storage_unavailable" });
  });
});
