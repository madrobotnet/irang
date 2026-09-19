import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("secrets stay out of the repo", () => {
  it("keeps env placeholders empty and commits no argon2 password hashes", () => {
    const example = readFileSync(".env.example", "utf8");
    expect(example).toContain("AUTH_PASSWORD_HASH=");
    expect(example).toContain("SESSION_SECRET=");
    expect(example).not.toMatch(/AUTH_PASSWORD_HASH=.+/m);
    expect(example).not.toMatch(/SESSION_SECRET=.+/m);

    const gitignore = readFileSync(".gitignore", "utf8");
    expect(gitignore).toMatch(/^\.env$/m);
  });
});
