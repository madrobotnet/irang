import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("notes id route", () => {
  it("redirects /notes/{id} onto the workspace note query", () => {
    const source = readFileSync(fileURLToPath(new URL("./page.tsx", import.meta.url)), "utf8");
    expect(source).toContain('redirect(`/notes?note=${encodeURIComponent(id)}`)');
  });
});
