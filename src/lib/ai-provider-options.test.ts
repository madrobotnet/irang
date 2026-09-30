import { expect, test } from "bun:test";
import { ApiKeySchema, BaseUrlSchema, ExtraHeadersSchema, ModelSchema } from "./ai-provider-options";

test("normalizes endpoint identity without excluding intentional local servers", () => {
  expect(BaseUrlSchema.parse(" HTTPS://EXAMPLE.COM:443/v1/// ")).toBe("https://example.com/v1");
  expect(BaseUrlSchema.parse("http://127.0.0.1:11434/v1")).toBe("http://127.0.0.1:11434/v1");
  expect(BaseUrlSchema.parse("http://[::1]:1234/v1")).toBe("http://[::1]:1234/v1");
});

test.each([
  "not-a-url", "file:///etc/passwd", "ftp://example.com/v1",
  "https://user:secret@example.com/v1", "https://example.com/v1?key=secret",
  "https://example.com/v1#secret",
])("rejects unsupported endpoint or embedded secret: %s", (url) => {
  expect(BaseUrlSchema.safeParse(url).success).toBe(false);
});

test("normalizes header names and rejects transport overrides and line injection", () => {
  expect(ExtraHeadersSchema.parse({ "X-Workspace": "one" })).toEqual({ "x-workspace": "one" });
  expect(ExtraHeadersSchema.safeParse({ Host: "other.example" }).success).toBe(false);
  expect(ExtraHeadersSchema.safeParse({ Cookie: "secret" }).success).toBe(false);
  expect(ExtraHeadersSchema.safeParse({ "X-Workspace": "one", "x-workspace": "two" }).success).toBe(false);
  expect(ExtraHeadersSchema.safeParse({ "X-Workspace": "one\r\nAuthorization: secret" }).success).toBe(false);
});

test("allows keyless custom credentials and common versioned model identifiers", () => {
  expect(ApiKeySchema.parse("")).toBe("");
  expect(ApiKeySchema.safeParse("key with spaces").success).toBe(false);
  expect(ModelSchema.parse(" vendor/model@2026-09:latest ")).toBe("vendor/model@2026-09:latest");
  expect(ModelSchema.safeParse("").success).toBe(false);
});
