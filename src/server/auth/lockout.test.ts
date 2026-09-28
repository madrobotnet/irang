import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import argon2 from "argon2";
import { verifyLogin } from "./lockout";
import { closeDb, query } from "@/server/db";
import { connectTestDatabase, resetData } from "@/server/test/db";

connectTestDatabase();
let hash: string;
beforeAll(async () => {
  hash = await argon2.hash("correct-password");
});
beforeEach(resetData);
afterAll(closeDb);

test("concurrent wrong passwords cannot exceed the five-attempt window", async () => {
  const results = await Promise.all(Array.from({ length: 8 }, () =>
    verifyLogin({ clientKey: "concurrent", password: "wrong", hash }),
  ));
  expect(results.filter((result) => result.kind === "wrong_password")).toHaveLength(4);
  expect(results.filter((result) => result.kind === "locked")).toHaveLength(4);
  const rows = await query<{ n: number }>("SELECT count(*)::int n FROM auth_login_failures");
  expect(rows).toEqual([{ n: 5 }]);
});

test("successful authentication clears only that client's prior failures", async () => {
  await query(
    "INSERT INTO auth_login_failures(client_key, attempted_at) VALUES ('owner', now()), ('other', now())",
  );
  const result = await verifyLogin({ clientKey: "owner", password: "correct-password", hash });
  expect(result).toEqual({ kind: "accepted" });
  expect(await query<{ client_key: string }>("SELECT client_key FROM auth_login_failures")).toEqual([
    { client_key: "other" },
  ]);
});

test("an active lock also rejects the correct password without extending the window", async () => {
  await query(
    "INSERT INTO auth_login_failures(client_key, attempted_at) SELECT 'locked', now() FROM generate_series(1, 5)",
  );
  const result = await verifyLogin({ clientKey: "locked", password: "correct-password", hash });
  expect(result.kind).toBe("locked");
  expect(await query<{ n: number }>("SELECT count(*)::int n FROM auth_login_failures")).toEqual([{ n: 5 }]);
});
