import { describe, expect, it } from "vitest";
import { isJevConfigured, jevConfigFromEnv } from "./env";

describe("jevConfigFromEnv", () => {
  it("returns null api key when unset", () => {
    expect(jevConfigFromEnv({})).toEqual({ apiKey: null, model: "jev-latest" });
    expect(isJevConfigured({})).toBe(false);
  });

  it("trims TYPESAFE_API_KEY and reads optional model override", () => {
    const cfg = jevConfigFromEnv({
      TYPESAFE_API_KEY: "  ts_test_key  ",
      TYPESAFE_JEV_MODEL: "jev-latest",
    });
    expect(cfg.apiKey).toBe("ts_test_key");
    expect(cfg.model).toBe("jev-latest");
    expect(isJevConfigured({ TYPESAFE_API_KEY: "x" })).toBe(true);
  });
});
