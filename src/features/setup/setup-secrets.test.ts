import { describe, expect, test } from "bun:test";
import { ApiClientError } from "@/lib/api-client";
import { setupFailure, validateSetupSecrets } from "./ai-form";

describe("validateSetupSecrets", () => {
  const base = { setupToken: "a".repeat(32), password: "b".repeat(12), passwordConfirmation: "b".repeat(12) };

  test("accepts boundary-length secrets", () => {
    expect(validateSetupSecrets(base)).toEqual({});
  });

  test("flags short token, invalid password length, and mismatch", () => {
    const short = validateSetupSecrets({ setupToken: "short", password: "12345678901", passwordConfirmation: "different" });
    expect(short.setupToken).toBeString();
    expect(short.password).toBeString();
    expect(short.passwordConfirmation).toBeString();
    expect(validateSetupSecrets({ ...base, password: "x".repeat(513), passwordConfirmation: "x".repeat(513) }).password).toBeString();
  });
});

describe("setupFailure", () => {
  test("maps installer access and recoverable server failures", () => {
    const forbidden = new ApiClientError(403, "forbidden", "detail");
    expect(setupFailure(forbidden).group).toBe("token");
    expect(setupFailure(forbidden).message).toBe(forbidden.message);
    for (const status of [400, 409, 503]) {
      const error = new ApiClientError(status, "server_error", "detail");
      expect(setupFailure(error).group).toBe("form");
      expect(setupFailure(error).message).toBe(error.message);
    }
    expect(setupFailure(new TypeError("fetch failed")).group).toBe("form");
  });
});
