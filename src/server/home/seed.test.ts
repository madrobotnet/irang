import { afterAll, beforeEach, expect, test } from "bun:test";
import { seedDemoVault } from "../../../scripts/seed";
import { closeDb, connectTestDatabase, resetData } from "@/server/test/db";
import { query } from "@/server/db";

connectTestDatabase();
beforeEach(resetData);
afterAll(closeDb);

test("rejects nonlocal hostnames that merely begin with a loopback prefix", async () => {
  const originalUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "postgres://qa:qa@127.remote.invalid/second_brain";
  try {
    await expect(seedDemoVault()).rejects.toThrow("로컬 개발 데이터베이스가 아닙니다");
    expect(await query<{ count: number }>("SELECT count(*)::int AS count FROM notes")).toEqual([{ count: 0 }]);
  } finally {
    if (originalUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalUrl;
  }
});
