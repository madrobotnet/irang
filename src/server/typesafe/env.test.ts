import { afterEach, describe, expect, it } from "vitest";
import { isTypesafeConfigured, typesafeApiKeyFromEnv } from "./env";

afterEach(() => {
  delete process.env.TYPESAFE_API_KEY;
});

describe("typesafe env", () => {
  it("reads TYPESAFE_API_KEY without exposing empty values", () => {
    expect(typesafeApiKeyFromEnv()).toBeNull();
    expect(isTypesafeConfigured()).toBe(false);
    process.env.TYPESAFE_API_KEY = "  sk-test  ";
    expect(typesafeApiKeyFromEnv()).toBe("sk-test");
    expect(isTypesafeConfigured()).toBe(true);
  });
});
