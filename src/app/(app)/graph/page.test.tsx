import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("graph route", () => {
  it("mounts GraphShell instead of the placeholder", () => {
    const source = readFileSync(fileURLToPath(new URL("./page.tsx", import.meta.url)), "utf8");
    expect(source).not.toContain("PlaceholderPage");
    expect(source).toContain("GraphShell");
    expect(source).not.toContain("API 연결됨");
  });
});
