import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isTypesafeConfigured, resolveTypesafeApiKey, typesafeApiKeyFromEnv } from "./env";

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

  it("refuses a production process that only has the dev key or a copied key", () => {
    const dev = { NODE_ENV: "test", TYPESAFE_API_KEY: "dev-key", TYPESAFE_PROD_API_KEY: "prod-key" } as NodeJS.ProcessEnv;
    expect(resolveTypesafeApiKey(dev)).toBe("dev-key");
    const prod = { NODE_ENV: "production", TYPESAFE_API_KEY: "dev-key", TYPESAFE_PROD_API_KEY: "prod-key" } as NodeJS.ProcessEnv;
    expect(resolveTypesafeApiKey(prod)).toBe("prod-key");
    const missing = { NODE_ENV: "production", TYPESAFE_API_KEY: "dev-key" } as NodeJS.ProcessEnv;
    expect(resolveTypesafeApiKey(missing)).toBeNull();
    const copied = { NODE_ENV: "production", TYPESAFE_API_KEY: "dev-key", TYPESAFE_PROD_API_KEY: "dev-key" } as NodeJS.ProcessEnv;
    expect(resolveTypesafeApiKey(copied)).toBeNull();
  });
});
