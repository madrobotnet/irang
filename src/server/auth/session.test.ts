import { afterAll, beforeEach, expect, test } from "bun:test";
import { createSession, revokeToken, sessionFromToken } from "./session";
import { closeDb, db, query } from "@/server/db";
import { connectTestDatabase, resetData } from "@/server/test/db";

connectTestDatabase();
beforeEach(resetData);
afterAll(closeDb);

test("simultaneous first logins share one owner", async () => {
  const pool = await db();
  const connections = await Promise.all(Array.from({ length: 6 }, () => pool.connect()));
  for (const connection of connections) connection.release();
  const input = { passwordHash: "test-hash", userAgent: null, ip: null };
  const sessions = await Promise.all(Array.from({ length: 6 }, () => createSession(input)));
  const rows = await query<{ owners: number; sessions: number }>(
    "SELECT (SELECT count(*)::int FROM users) owners, (SELECT count(*)::int FROM sessions) sessions",
  );
  expect(rows).toEqual([{ owners: 1, sessions: 6 }]);
  expect(new Set(sessions.map((session) => session.token)).size).toBe(6);
});

test("revoking a token makes its session unusable", async () => {
  const session = await createSession({ passwordHash: "test-hash", userAgent: null, ip: null });
  expect(await sessionFromToken(session.token)).not.toBeNull();
  await revokeToken(session.token);
  expect(await sessionFromToken(session.token)).toBeNull();
});

test("expired session tokens cannot authenticate", async () => {
  const session = await createSession({ passwordHash: "test-hash", userAgent: null, ip: null });
  await query("UPDATE sessions SET expires_at = now() - interval '1 day'");
  expect(await sessionFromToken(session.token)).toBeNull();
});
