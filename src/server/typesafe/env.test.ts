import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isTypesafeConfigured, typesafeApiKeyFromEnv } from "./env";

let savedTypesafeKey: string | undefined;

beforeEach(() => {
  savedTypesafeKey = process.env.TYPESAFE_API_KEY;
  delete process.env.TYPESAFE_API_KEY;
});

afterEach(() => {
  if (savedTypesafeKey === undefined) {
    delete process.env.TYPESAFE_API_KEY;
  } else {
    process.env.TYPESAFE_API_KEY = savedTypesafeKey;
  }
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
