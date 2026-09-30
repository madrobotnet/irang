import { expect, spyOn, test } from "bun:test";
import { api, ApiClientError } from "@/lib/api-client";
import { localizedApiError } from "./api-error";

test("the same retained API failure follows the current locale", () => {
  const localized = { ko: "ko-marker", en: "en-marker" };
  const failure = new ApiClientError(409, "conflict", localized.en, {
    error: { code: "conflict", message: localized.en, localized },
  });
  expect(localizedApiError(failure, "en", "fallback-marker")).toBe(localized.en);
  expect(localizedApiError(failure, "ko", "fallback-marker")).toBe(localized.ko);
});

test("legacy and transport failures use the caller's localized fallback", () => {
  for (const failure of [new ApiClientError(500, "internal", "diagnostic"), new Error("transport"), null]) {
    expect(localizedApiError(failure, "en", "fallback-marker")).toBe("fallback-marker");
  }
});

test("a nonstandard JSON failure from the HTTP boundary uses the fallback", async () => {
  const request = spyOn(globalThis, "fetch").mockResolvedValue(Response.json({}, { status: 503 }));
  try {
    const failure = await api("/api/example").catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiClientError);
    expect(localizedApiError(failure, "en", "fallback-marker")).toBe("fallback-marker");
  } finally {
    request.mockRestore();
  }
});
