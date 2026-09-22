import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { after, before, beforeEach, it } from "node:test";
import postgres from "postgres";
import { migrate } from "../../src/db/migrate";
import { closeDb } from "../../src/db/client";
import { clearFailures, lockStatus, recordFailure } from "../../src/lib/auth/lockout";
import { createSession, listSessions, resolveSession, revokeById, revokeByToken, SESSION_COOKIE, SESSION_MAX, SESSION_TTL_MS } from "../../src/lib/auth/session";
import { writeAudit } from "../../src/lib/auth/audit";

const originalUrl = process.env["DATABASE_URL"];
assert.ok(originalUrl, "DATABASE_URL must be set for database integration tests");
const schema = `auth_test_${randomUUID().replaceAll("-", "")}`;
const isolatedUrl = new URL(originalUrl);
isolatedUrl.searchParams.set("search_path", schema);
process.env["DATABASE_URL"] = isolatedUrl.toString();
const database = postgres(isolatedUrl.toString(), {
  max: 4,
  connect_timeout: 5,
  idle_timeout: 5,
  connection: { statement_timeout: 10000, client_min_messages: "warning" },
});

before(async () => {
  await database`CREATE SCHEMA ${database(schema)}`;
  await migrate();
});
beforeEach(async () => {
  await database`TRUNCATE sessions, login_failures, login_locks, audit_events`;
});
after(async () => {
  try {
    await closeDb();
    await database`DROP SCHEMA ${database(schema)} CASCADE`;
  } finally {
    await database.end();
    process.env["DATABASE_URL"] = originalUrl;
  }
});

it("preserves auth tables when the migration is applied again", async () => {
  // Given: an isolated migrated schema.
  // When
  await migrate();
  // Then
  const tables = await database<{ readonly table_name: string }[]>`
    SELECT table_name FROM information_schema.tables WHERE table_schema = ${schema} ORDER BY table_name
  `;
  assert.deepEqual(tables.map((table) => table.table_name), [
    "ai_jobs",
    "attachments",
    "audit_events",
    "inbox_items",
    "judgments",
    "login_failures",
    "login_locks",
    "note_tags",
    "notes",
    "search_docs",
    "sessions",
    "tags",
  ]);
});

const now = new Date("2030-01-01T00:00:00Z");
const windowMs = 15 * 60 * 1000;
const ip = "192.0.2.1";

it("locks for 15 minutes when the fifth recent failure is recorded", async () => {
  // Given
  for (let i = 0; i < 4; i++) await recordFailure(ip, now);
  assert.equal((await lockStatus(ip, now)).locked, false);
  // When
  await recordFailure(ip, now);
  // Then
  assert.deepEqual(await lockStatus(ip, now), { locked: true, lockedUntil: new Date(now.getTime() + windowMs) });
});

it("does not lock when a fifth failure lies outside the window", async () => {
  // Given
  await recordFailure(ip, new Date(now.getTime() - windowMs - 1));
  for (let i = 0; i < 3; i++) await recordFailure(ip, now);
  // When
  await recordFailure(ip, now);
  // Then
  assert.deepEqual(await lockStatus(ip, now), { locked: false, lockedUntil: null });
});

it("preserves the deadline when another failure arrives while locked", async () => {
  // Given
  for (let i = 0; i < 5; i++) await recordFailure(ip, now);
  const later = new Date(now.getTime() + 60_000);
  // When
  await recordFailure(ip, later);
  // Then
  assert.deepEqual(await lockStatus(ip, later), { locked: true, lockedUntil: new Date(now.getTime() + windowMs) });
});

it("unlocks when the lock deadline is reached", async () => {
  // Given
  for (let i = 0; i < 5; i++) await recordFailure(ip, now);
  // When
  const status = await lockStatus(ip, new Date(now.getTime() + windowMs));
  // Then
  assert.equal(status.locked, false);
});

it("clears the failure history when a lock is cleared", async () => {
  // Given
  for (let i = 0; i < 5; i++) await recordFailure(ip, now);
  // When
  await clearFailures(ip);
  // Then
  assert.equal((await lockStatus(ip, now)).locked, false);
  const rows = await database`SELECT id FROM login_failures WHERE ip = ${ip}`;
  assert.equal(rows.length, 0);
});

it("sets one deadline when five failures arrive concurrently", async () => {
  // Given / When
  await Promise.all(Array.from({ length: 5 }, () => recordFailure(ip, now)));
  // Then
  assert.deepEqual(await lockStatus(ip, now), { locked: true, lockedUntil: new Date(now.getTime() + windowMs) });
});

it("leaves another IP unlocked when one IP reaches the threshold", async () => {
  // Given
  for (let i = 0; i < 5; i++) await recordFailure(ip, now);
  // When
  const status = await lockStatus("192.0.2.2", now);
  // Then
  assert.equal(status.locked, false);
});

it("stores only a digest when a random seven-day session is created", async () => {
  // Given / When
  const session = await createSession({ ip, userAgent: "auth-test" }, now);
  // Then: secret comparisons are boolean-only.
  const [stored] = await database<{ readonly token_hash: string }[]>`SELECT token_hash FROM sessions WHERE id = ${session.id}`;
  assert.ok(stored);
  assert.equal(Buffer.from(session.token, "hex").length, 32);
  assert.equal(stored.token_hash === session.token, false);
  assert.equal(stored.token_hash === createHash("sha256").update(session.token).digest("hex"), true);
  assert.equal(session.expiresAt.getTime() - now.getTime(), 7 * 24 * 60 * 60 * 1000);
  assert.equal(SESSION_TTL_MS, 604800000);
  assert.equal(SESSION_MAX, 5);
  assert.equal(SESSION_COOKIE, "brain_session");
});

it("evicts the oldest active session when a sixth session is created", async () => {
  // Given
  const oldest = await createSession({}, now);
  for (let i = 1; i < 5; i++) await createSession({}, new Date(now.getTime() + i));
  const later = new Date(now.getTime() + 5);
  // When
  const newest = await createSession({}, later);
  // Then
  assert.equal(await resolveSession(oldest.token, later), null);
  assert.equal((await resolveSession(newest.token, later))?.id, newest.id);
  assert.equal((await listSessions(later)).length, 5);
});

it("caps active sessions when creation is concurrent", async () => {
  // Given / When
  await Promise.all(Array.from({ length: 12 }, () => createSession({}, now)));
  // Then
  assert.equal((await listSessions(now)).length, 5);
});

it("rejects a session when its expiry deadline is reached", async () => {
  // Given
  const session = await createSession({}, now);
  // When
  const resolved = await resolveSession(session.token, session.expiresAt);
  // Then
  assert.equal(resolved, null);
});

it("rejects a token when it has no stored session", async () => {
  // Given / When
  const resolved = await resolveSession(randomUUID(), now);
  // Then
  assert.equal(resolved, null);
});

it("updates last-seen time when a valid session is resolved", async () => {
  // Given
  const session = await createSession({ ip, userAgent: "auth-test" }, now);
  const later = new Date(now.getTime() + 1_000);
  // When
  const resolved = await resolveSession(session.token, later);
  // Then
  assert.ok(resolved);
  assert.equal(resolved.id, session.id);
  assert.deepEqual(resolved.lastSeenAt, later);
  assert.equal(resolved.ip, ip);
  assert.equal(resolved.userAgent, "auth-test");
  assert.equal("token_hash" in resolved || "token" in resolved, false);
});

it("lists only active sessions when expired sessions exist", async () => {
  // Given
  await createSession({}, new Date(now.getTime() - SESSION_TTL_MS));
  const active = await createSession({}, now);
  // When
  const sessions = await listSessions(now);
  // Then
  assert.deepEqual(sessions.map((session) => session.id), [active.id]);
  assert.equal(sessions.some((session) => "token_hash" in session || "token" in session), false);
});

it("revokes a session when identified by token", async () => {
  // Given
  const session = await createSession({}, now);
  // When
  await revokeByToken(session.token);
  // Then
  assert.equal(await resolveSession(session.token, now), null);
});

it("revokes a session when identified by id", async () => {
  // Given
  const session = await createSession({}, now);
  // When
  await revokeById(session.id);
  // Then
  assert.equal(await resolveSession(session.token, now), null);
});

it("persists structured metadata when an audit event is written", async () => {
  // Given
  const meta = { reason: "invalid_password", attempts: 1 };
  // When
  await writeAudit("login_failure", ip, meta);
  // Then
  const rows = await database<{ readonly action: string; readonly ip: string; readonly meta: typeof meta }[]>`SELECT action, ip, meta FROM audit_events`;
  assert.deepEqual(Array.from(rows), [{ action: "login_failure", ip, meta }]);
});

it("runs the migration CLI when launched outside the repository", async () => {
  // Given
  const entry = new URL("../../src/db/migrate.ts", import.meta.url).pathname;
  // When: subscribe to completion before the child can emit its close event.
  const exitCode = await new Promise<number | null>((resolve, reject) => {
    const child = spawn(process.execPath, [entry], { cwd: "/tmp", env: process.env, stdio: "ignore", timeout: 10_000 });
    child.once("error", reject);
    child.once("close", resolve);
  });
  // Then
  assert.equal(exitCode, 0);
});

it("fails the migration CLI when DATABASE_URL is missing", async () => {
  // Given
  const entry = new URL("../../src/db/migrate.ts", import.meta.url).pathname;
  const env = { ...process.env, DATABASE_URL: "" };
  // When
  const exitCode = await new Promise<number | null>((resolve, reject) => {
    const child = spawn(process.execPath, [entry], { cwd: "/tmp", env, stdio: "ignore", timeout: 10_000 });
    child.once("error", reject);
    child.once("close", resolve);
  });
  // Then
  assert.equal(exitCode, 1);
});
