import { afterEach, describe, expect, test } from "bun:test";
import { passwordHash } from "./config";

const originalPasswordHash = process.env.AUTH_PASSWORD_HASH;

afterEach(() => {
  if (originalPasswordHash === undefined) delete process.env.AUTH_PASSWORD_HASH;
  else process.env.AUTH_PASSWORD_HASH = originalPasswordHash;
});

describe("passwordHash", () => {
  test("accepts an intact Argon2 PHC value", () => {
    const value = "$argon2id$v=19$m=65536,t=3,p=4$c2FsdA$aGFzaA";
    process.env.AUTH_PASSWORD_HASH = value;

    expect(passwordHash()).toBe(value);
  });

  test("normalizes a dotenv-escaped Argon2 PHC value", () => {
    process.env.AUTH_PASSWORD_HASH = "\\$argon2id\\$v=19\\$m=65536,t=3,p=4\\$c2FsdA\\$aGFzaA";

    expect(passwordHash()).toBe("$argon2id$v=19$m=65536,t=3,p=4$c2FsdA$aGFzaA");
  });

  test("rejects a hash damaged by dotenv variable expansion", () => {
    process.env.AUTH_PASSWORD_HASH = "=19=65536,t=3,p=4";

    expect(() => passwordHash()).toThrow("not a valid Argon2 PHC string");
  });
});
