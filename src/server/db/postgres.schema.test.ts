import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const postgresSource = readFileSync(new URL("./postgres.ts", import.meta.url), "utf8");

describe("ensureAuthSchema (postgres.ts)", () => {
  it("does not drop sessions or other auth tables on cold start", () => {
    expect(postgresSource).not.toMatch(/DROP\s+TABLE/i);
  });

  it("uses create-if-not-exists for auth tables", () => {
    expect(postgresSource).toMatch(/CREATE TABLE IF NOT EXISTS sessions/);
    expect(postgresSource).toMatch(/CREATE TABLE IF NOT EXISTS users/);
  });
});
