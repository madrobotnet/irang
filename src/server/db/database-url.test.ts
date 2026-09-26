import { describe, expect, it } from "vitest";
import {
  buildPostgresDatabaseUrl,
  DatabaseUrlConfigError,
  databaseUrlTargetForLog,
  validateDatabaseUrl,
} from "./database-url";

describe("database-url", () => {
  it("rejects unencoded # in password (Invalid URL recurrence)", () => {
    expect(() =>
      validateDatabaseUrl("postgres://second_brain:p#ass@db:5432/second_brain"),
    ).toThrow(DatabaseUrlConfigError);
    try {
      validateDatabaseUrl("postgres://second_brain:p#ass@db:5432/second_brain");
    } catch (error) {
      expect((error as DatabaseUrlConfigError).message).toMatch(/percent-encode/i);
      expect((error as DatabaseUrlConfigError).message).not.toMatch(/p#ass/);
    }
  });

  it("accepts percent-encoded special characters", () => {
    const built = buildPostgresDatabaseUrl({
      user: "second_brain",
      password: "p#ass!",
      host: "db",
      port: 5432,
      database: "second_brain",
    });
    const parsed = validateDatabaseUrl(built);
    expect(decodeURIComponent(parsed.password)).toBe("p#ass!");
    expect(parsed.hostname).toBe("db");
  });

  it("buildPostgresDatabaseUrl encodes ! and # for URL parsing", () => {
    const url = buildPostgresDatabaseUrl({
      user: "u",
      password: "x#y!z",
      host: "127.0.0.1",
      port: 5432,
      database: "db",
    });
    expect(() => new URL(url)).not.toThrow();
    expect(decodeURIComponent(validateDatabaseUrl(url).password)).toBe("x#y!z");
  });

  it("databaseUrlTargetForLog never includes the password", () => {
    const url = buildPostgresDatabaseUrl({
      user: "second_brain",
      password: "secret#token",
      host: "db",
      port: 5432,
      database: "second_brain",
    });
    const label = databaseUrlTargetForLog(url);
    expect(label).toBe("second_brain@db:5432/second_brain");
    expect(label).not.toContain("secret");
    expect(label).not.toContain("#");
  });
});
