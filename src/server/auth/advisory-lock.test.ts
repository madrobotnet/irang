import { describe, expect, it } from "vitest";
import type { Pool } from "pg";
import type { SessionRecord } from "@/domain/auth/types";
import { LOCKOUT_MS, MAX_FAILURES } from "@/domain/auth/constants";
import {
  loginAdvisoryLockKey,
  SESSION_ADVISORY_LOCK_KEY,
} from "../db/advisory-lock";
import { PostgresLockoutRepository, PostgresSessionRepository } from "./postgres-repos";

type LoggedQuery = { sql: string; params: readonly unknown[] | undefined };

function loggingPool(handler: (sql: string) => { rows: unknown[] }): {
  pool: Pool;
  queries: LoggedQuery[];
} {
  const queries: LoggedQuery[] = [];
  const client = {
    async query(sql: string, params?: readonly unknown[]) {
      queries.push({ sql, params });
      return handler(sql);
    },
    release() {},
  };
  const pool = {
    async connect() {
      return client;
    },
  } as unknown as Pool;
  return { pool, queries };
}

function session(): SessionRecord {
  return {
    publicId: "00000000-0000-4000-8000-000000000010",
    tokenHashHex: "ab".repeat(32),
    createdAt: 1_000_000,
    expiresAt: 2_000_000,
    revokedAt: null,
  };
}

describe("postgres advisory locks", () => {
  it("serializes the session cap with brain:sessions before insert", async () => {
    const { pool, queries } = loggingPool((sql) => {
      if (sql.includes("UPDATE sessions")) {
        return { rows: [{ id: "00000000-0000-4000-8000-000000000001" }] };
      }
      return { rows: [] };
    });
    const repo = new PostgresSessionRepository(pool, "00000000-0000-4000-8000-000000000099");
    const dropped = await repo.insertEnforcingCap(
      session(),
      "00000000-0000-4000-8000-000000000099",
      1_000_000,
      5,
    );

    expect(dropped).toEqual(["00000000-0000-4000-8000-000000000001"]);
    const begin = queries.findIndex((query) => query.sql === "BEGIN");
    const lock = queries.findIndex((query) => query.sql.includes("pg_advisory_xact_lock"));
    const update = queries.findIndex((query) => query.sql.includes("UPDATE sessions"));
    const insert = queries.findIndex((query) => query.sql.includes("INSERT INTO sessions"));
    const commit = queries.findIndex((query) => query.sql === "COMMIT");
    expect(begin).toBeGreaterThanOrEqual(0);
    expect(lock).toBeGreaterThan(begin);
    expect(update).toBeGreaterThan(lock);
    expect(insert).toBeGreaterThan(update);
    expect(commit).toBeGreaterThan(insert);
    expect(queries[lock]?.params).toEqual([SESSION_ADVISORY_LOCK_KEY]);
    expect(SESSION_ADVISORY_LOCK_KEY).toBe("brain:sessions");
    expect(queries[lock]?.sql).toContain("hashtext(current_schema())");
  });

  it("serializes login failures with brain:login: and does not extend an active lock", async () => {
    const clientKey = "203.0.113.9";
    const { pool, queries } = loggingPool((sql) => {
      if (sql.includes("SELECT locked_until")) {
        return { rows: [{ locked_until: new Date(2_000_000) }] };
      }
      return { rows: [] };
    });
    const repo = new PostgresLockoutRepository(pool);
    const result = await repo.recordFailureUnderLock(clientKey, 1_000_000, {
      windowMs: 15 * 60 * 1000,
      maxFailures: MAX_FAILURES,
      lockoutMs: LOCKOUT_MS,
    });

    expect(result).toEqual({ kind: "already_locked", lockedUntil: 2_000_000 });
    const lock = queries.find((query) => query.sql.includes("pg_advisory_xact_lock"));
    expect(lock?.params).toEqual([loginAdvisoryLockKey(clientKey)]);
    expect(loginAdvisoryLockKey(clientKey)).toBe("brain:login:203.0.113.9");
    expect(queries.some((query) => query.sql.includes("INSERT INTO auth_login_failures"))).toBe(
      false,
    );
    expect(queries.some((query) => query.sql.includes("UPDATE auth_lockouts"))).toBe(false);
    expect(queries.at(-1)?.sql).toBe("COMMIT");
  });

  it("clears failures under the same per-client advisory key", async () => {
    const { pool, queries } = loggingPool(() => ({ rows: [] }));
    const repo = new PostgresLockoutRepository(pool);
    await repo.clearUnderLock("198.51.100.4");
    const lock = queries.find((query) => query.sql.includes("pg_advisory_xact_lock"));
    expect(lock?.params).toEqual(["brain:login:198.51.100.4"]);
    expect(queries.some((query) => query.sql.includes("DELETE FROM auth_login_failures"))).toBe(
      true,
    );
    expect(queries.some((query) => query.sql.includes("SET locked_until = NULL"))).toBe(true);
  });
});
