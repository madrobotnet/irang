import { afterEach, describe, expect, it } from "vitest";
import { resetPoolForTests } from "../db/postgres";
import { AuthStorageInitError } from "./init-errors";
import {
  createAuthDepsFromEnv,
  getAuthRuntime,
  loadAuthEnv,
  setAuthRuntimeForTests,
} from "./runtime";

const envSnapshot = {
  databaseUrl: process.env.DATABASE_URL,
  passwordHash: process.env.AUTH_PASSWORD_HASH,
};

afterEach(() => {
  setAuthRuntimeForTests(null);
  resetPoolForTests();
  if (envSnapshot.databaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = envSnapshot.databaseUrl;
  }
  if (envSnapshot.passwordHash === undefined) {
    delete process.env.AUTH_PASSWORD_HASH;
  } else {
    process.env.AUTH_PASSWORD_HASH = envSnapshot.passwordHash;
  }
});

describe("loadAuthEnv", () => {
  it("reads AUTH_PASSWORD_HASH and DATABASE_URL without mutation", () => {
    process.env.AUTH_PASSWORD_HASH = "hash";
    process.env.DATABASE_URL = "postgres://u:p@h/db";
    expect(loadAuthEnv()).toEqual({ passwordHash: "hash", databaseUrl: "postgres://u:p@h/db" });
  });
});

describe("getAuthRuntime", () => {
  it("uses in-memory deps when AUTH_PASSWORD_HASH is missing", async () => {
    delete process.env.AUTH_PASSWORD_HASH;
    delete process.env.DATABASE_URL;
    const { deps } = await getAuthRuntime();
    expect(deps.passwordHashEnv).toBe("");
  });

  it("throws AuthStorageInitError for invalid DATABASE_URL (# fragment)", async () => {
    process.env.AUTH_PASSWORD_HASH = "stored-hash";
    process.env.DATABASE_URL = "postgres://second_brain:p#ass@db:5432/second_brain";
    await expect(getAuthRuntime()).rejects.toBeInstanceOf(AuthStorageInitError);
    await expect(getAuthRuntime()).rejects.toMatchObject({
      reason: "invalid_database_url",
    });
  });
});

describe("createAuthDepsFromEnv", () => {
  it("maps ensureAuthSchema failures to storage_unavailable", async () => {
    process.env.AUTH_PASSWORD_HASH = "stored-hash";
    process.env.DATABASE_URL = "postgres://second_brain:pass@127.0.0.1:1/nope";
    await expect(createAuthDepsFromEnv()).rejects.toMatchObject({
      reason: "storage_unavailable",
    });
  });
});
