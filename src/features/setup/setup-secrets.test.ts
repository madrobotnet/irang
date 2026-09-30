import { describe, expect, test } from "bun:test";
import { ApiClientError } from "@/lib/api-client";
import { LOCALES } from "@/lib/i18n/locale";
import { setupFailure, setupFailureText, validateSetupSecrets } from "./ai-form";
import { SETUP_COPY } from "./setup-copy";

describe("validateSetupSecrets", () => {
  const base = { setupToken: "a".repeat(32), password: "b".repeat(12), passwordConfirmation: "b".repeat(12) };

  test("accepts boundary-length secrets", () => {
    expect(validateSetupSecrets(base)).toEqual({});
  });

  test("flags short token, invalid password length, and mismatch", () => {
    expect(validateSetupSecrets({ setupToken: "short", password: "12345678901", passwordConfirmation: "different" })).toEqual({
      setupToken: "setupTokenShort",
      password: "passwordShort",
      passwordConfirmation: "passwordMismatch",
    });
    expect(validateSetupSecrets({ ...base, password: "x".repeat(513), passwordConfirmation: "x".repeat(513) })).toEqual({
      password: "passwordLong",
    });
  });
});

describe("setupFailure", () => {
  test("maps installer access to the token field and keeps the failure itself", () => {
    const forbidden = new ApiClientError(403, "forbidden", "detail");
    expect(setupFailure(forbidden)).toEqual({ group: "token", cause: forbidden });
    for (const status of [400, 409, 500, 503]) {
      const error = new ApiClientError(status, "server_error", "detail");
      expect(setupFailure(error)).toEqual({ group: "form", cause: error });
    }
    expect(setupFailure(new TypeError("fetch failed")).group).toBe("form");
  });

  test("a retained failure shows the server's text in the current locale, else a local fallback", () => {
    const localized = { ko: "ko-marker", en: "en-marker" };
    const explained = (status: number) =>
      new ApiClientError(status, "server_error", localized.en, { error: { code: "server_error", message: localized.en, localized } });
    for (const locale of LOCALES) {
      const copy = SETUP_COPY[locale].failure;
      for (const status of [400, 403, 409, 503]) {
        expect(setupFailureText(setupFailure(explained(status)), locale)).toBe(localized[locale]);
      }
      expect(setupFailureText(setupFailure(explained(500)), locale)).toBe(copy.save);
      expect(setupFailureText(setupFailure(new ApiClientError(403, "forbidden", "legacy diagnostic")), locale)).toBe(copy.token);
      expect(setupFailureText(setupFailure(new TypeError("fetch failed")), locale)).toBe(copy.network);
    }
  });
});
