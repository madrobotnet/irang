import { describe, expect, test } from "bun:test";
import { sanitizeNextUrl } from "./next-url";

describe("sanitizeNextUrl", () => {
  test("keeps same-origin paths with query and hash", () => {
    expect(sanitizeNextUrl("/notes/abc?tab=links#x")).toBe("/notes/abc?tab=links#x");
    expect(sanitizeNextUrl(["/inbox", "/other"])).toBe("/inbox");
  });

  test("rejects anything that could leave the origin", () => {
    for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)", "/a\\b", "/a\nb", "notes", ""]) {
      expect(sanitizeNextUrl(bad)).toBe("/");
    }
  });

  test("never loops back to login or into the API", () => {
    expect(sanitizeNextUrl("/login")).toBe("/");
    expect(sanitizeNextUrl("/login?next=/x")).toBe("/");
    expect(sanitizeNextUrl("/api/notes")).toBe("/");
    expect(sanitizeNextUrl("/loginx")).toBe("/loginx");
  });

  test("missing value falls back to home", () => {
    expect(sanitizeNextUrl(undefined)).toBe("/");
    expect(sanitizeNextUrl(null)).toBe("/");
  });
});
