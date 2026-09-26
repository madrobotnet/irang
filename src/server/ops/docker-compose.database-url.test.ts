import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const compose = readFileSync(path.join(process.cwd(), "docker-compose.yml"), "utf8");

describe("docker-compose DATABASE_URL", () => {
  it("does not interpolate POSTGRES_APP_PASSWORD into the app DATABASE_URL", () => {
    expect(compose).not.toMatch(/postgres:\/\/second_brain:\$\{POSTGRES_APP_PASSWORD\}/);
    expect(compose).toMatch(/\$\{DATABASE_URL:\?/);
  });
});
