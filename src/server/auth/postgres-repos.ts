import { lockoutFromFailures } from "@/domain/auth/lockout";
import type { AuditKind, SessionRecord } from "@/domain/auth/types";
import type { Pool } from "pg";
import {
  loginAdvisoryLockKey,
  SESSION_ADVISORY_LOCK_KEY,
  withAdvisoryTransaction,
} from "../db/advisory-lock";
import { tokenHashToBuffer } from "./crypto";
import type {
  AuditRepository,
  FailureRecordResult,
  LockoutRepository,
  LockoutWindow,
  SessionRepository,
  UserRepository,
} from "./ports";

function epochMs(value: Date | string | number): number {
  if (typeof value === "number") {
    return value;
  }
  return new Date(value).getTime();
}

function rowToSession(row: {
  id: string;
  token_hash: Buffer;
  created_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
}): SessionRecord {
  return {
    publicId: row.id,
    tokenHashHex: row.token_hash.toString("hex"),
    createdAt: epochMs(row.created_at),
    expiresAt: epochMs(row.expires_at),
    revokedAt: row.revoked_at ? epochMs(row.revoked_at) : null,
  };
}

export class PostgresUserRepository implements UserRepository {
  constructor(private readonly pool: Pool) {}

  async ensureBootstrap(passwordHash: string): Promise<string> {
    const existing = await this.pool.query(`SELECT id FROM users ORDER BY created_at ASC LIMIT 1`);
    if (existing.rows[0]) {
      await this.pool.query(`UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`, [
        passwordHash,
        existing.rows[0].id,
      ]);
      return existing.rows[0].id as string;
    }
    const inserted = await this.pool.query(
      `INSERT INTO users (password_hash) VALUES ($1) RETURNING id`,
      [passwordHash],
    );
    return inserted.rows[0].id as string;
  }

  async getPasswordHash(): Promise<string | null> {
    const result = await this.pool.query(
      `SELECT password_hash FROM users ORDER BY created_at ASC LIMIT 1`,
    );
    return result.rows[0]?.password_hash ?? null;
  }
}

export class PostgresSessionRepository implements SessionRepository {
  constructor(
    private readonly pool: Pool,
    private readonly userId: string,
  ) {}

  async insert(session: SessionRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, revoked_at)
       VALUES ($1, $2, $3, to_timestamp($4 / 1000.0), to_timestamp($5 / 1000.0), NULL)`,
      [
        session.publicId,
        this.userId,
        tokenHashToBuffer(session.tokenHashHex),
        session.createdAt,
        session.expiresAt,
      ],
    );
  }

  async insertEnforcingCap(
    session: SessionRecord,
    userId: string,
    now: number,
    maxSessions: number,
  ): Promise<string[]> {
    return withAdvisoryTransaction(this.pool, SESSION_ADVISORY_LOCK_KEY, async (client) => {
      const dropped = await client.query<{ id: string }>(
        `UPDATE sessions SET revoked_at = to_timestamp($2 / 1000.0)
         WHERE id IN (
           SELECT id FROM sessions
           WHERE user_id = $1
             AND revoked_at IS NULL
             AND expires_at > to_timestamp($2 / 1000.0)
           ORDER BY created_at DESC, id DESC
           OFFSET $3
         )
         RETURNING id`,
        [userId, now, Math.max(0, maxSessions - 1)],
      );
      await client.query(
        `INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, revoked_at)
         VALUES ($1, $2, $3, to_timestamp($4 / 1000.0), to_timestamp($5 / 1000.0), NULL)`,
        [
          session.publicId,
          userId,
          tokenHashToBuffer(session.tokenHashHex),
          session.createdAt,
          session.expiresAt,
        ],
      );
      return dropped.rows.map((row) => row.id);
    });
  }

  async findByTokenHashHex(tokenHashHex: string): Promise<SessionRecord | null> {
    const result = await this.pool.query(
      `SELECT id, token_hash, created_at, expires_at, revoked_at
       FROM sessions WHERE token_hash = $1`,
      [tokenHashToBuffer(tokenHashHex)],
    );
    const row = result.rows[0];
    return row ? rowToSession(row) : null;
  }

  async revokeByTokenHashHex(tokenHashHex: string, at: number): Promise<void> {
    await this.pool.query(
      `UPDATE sessions SET revoked_at = to_timestamp($2 / 1000.0)
       WHERE token_hash = $1 AND revoked_at IS NULL`,
      [tokenHashToBuffer(tokenHashHex), at],
    );
  }

  async listActiveForUser(userId: string, now: number): Promise<SessionRecord[]> {
    const result = await this.pool.query(
      `SELECT id, token_hash, created_at, expires_at, revoked_at
       FROM sessions
       WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > to_timestamp($2 / 1000.0)`,
      [userId, now],
    );
    return result.rows.map(rowToSession);
  }

  async revokeByPublicIds(publicIds: string[], at: number): Promise<void> {
    if (publicIds.length === 0) {
      return;
    }
    await this.pool.query(
      `UPDATE sessions SET revoked_at = to_timestamp($2 / 1000.0)
       WHERE id = ANY($1::uuid[]) AND revoked_at IS NULL`,
      [publicIds, at],
    );
  }
}

export class PostgresLockoutRepository implements LockoutRepository {
  constructor(private readonly pool: Pool) {}

  async getLockedUntil(clientKey: string): Promise<number | null> {
    const result = await this.pool.query(
      `SELECT locked_until FROM auth_lockouts WHERE client_key = $1`,
      [clientKey],
    );
    const row = result.rows[0];
    if (!row?.locked_until) {
      return null;
    }
    return epochMs(row.locked_until);
  }

  async setLockedUntil(clientKey: string, lockedUntil: number): Promise<void> {
    await this.pool.query(
      `INSERT INTO auth_lockouts (client_key, failure_count, window_started_at, locked_until, updated_at)
       VALUES ($1, 0, now(), to_timestamp($2 / 1000.0), now())
       ON CONFLICT (client_key) DO UPDATE
       SET locked_until = EXCLUDED.locked_until, failure_count = 0, updated_at = now()`,
      [clientKey, lockedUntil],
    );
  }

  async clearLock(clientKey: string): Promise<void> {
    await this.pool.query(`DELETE FROM auth_login_failures WHERE client_key = $1`, [clientKey]);
    await this.pool.query(
      `UPDATE auth_lockouts
       SET locked_until = NULL, failure_count = 0, updated_at = now()
       WHERE client_key = $1`,
      [clientKey],
    );
  }

  async addFailure(clientKey: string, at: number): Promise<void> {
    await this.pool.query(
      `INSERT INTO auth_login_failures (client_key, attempted_at)
       VALUES ($1, to_timestamp($2 / 1000.0))`,
      [clientKey, at],
    );
    const failures = await this.listFailuresSince(clientKey, at - 15 * 60 * 1000);
    await this.pool.query(
      `INSERT INTO auth_lockouts (client_key, failure_count, window_started_at, updated_at)
       VALUES ($1, $2, to_timestamp($3 / 1000.0), now())
       ON CONFLICT (client_key) DO UPDATE
       SET failure_count = $2, window_started_at = to_timestamp($3 / 1000.0), updated_at = now()`,
      [clientKey, failures.length, failures[0] ?? at],
    );
  }

  async listFailuresSince(clientKey: string, since: number): Promise<number[]> {
    const result = await this.pool.query(
      `SELECT attempted_at FROM auth_login_failures
       WHERE client_key = $1 AND attempted_at > to_timestamp($2 / 1000.0)`,
      [clientKey, since],
    );
    return result.rows.map((row) => epochMs(row.attempted_at));
  }

  async clearFailures(clientKey: string): Promise<void> {
    await this.pool.query(`DELETE FROM auth_login_failures WHERE client_key = $1`, [clientKey]);
    await this.pool.query(
      `UPDATE auth_lockouts
       SET failure_count = 0, updated_at = now()
       WHERE client_key = $1`,
      [clientKey],
    );
  }

  async recordFailureUnderLock(
    clientKey: string,
    now: number,
    window: LockoutWindow,
  ): Promise<FailureRecordResult> {
    return withAdvisoryTransaction(this.pool, loginAdvisoryLockKey(clientKey), async (client) => {
      const active = await client.query<{ locked_until: Date }>(
        `SELECT locked_until FROM auth_lockouts
         WHERE client_key = $1 AND locked_until > to_timestamp($2 / 1000.0)`,
        [clientKey, now],
      );
      const lockedRow = active.rows[0];
      if (lockedRow?.locked_until) {
        return { kind: "already_locked", lockedUntil: epochMs(lockedRow.locked_until) };
      }

      await client.query(
        `INSERT INTO auth_login_failures (client_key, attempted_at)
         VALUES ($1, to_timestamp($2 / 1000.0))`,
        [clientKey, now],
      );
      const since = now - window.windowMs;
      const failures = await client.query<{ attempted_at: Date }>(
        `SELECT attempted_at FROM auth_login_failures
         WHERE client_key = $1
           AND attempted_at > to_timestamp($2 / 1000.0)
           AND attempted_at <= to_timestamp($3 / 1000.0)`,
        [clientKey, since, now],
      );
      const timestamps = failures.rows.map((row) => epochMs(row.attempted_at));
      const decision = lockoutFromFailures(
        timestamps,
        now,
        window.maxFailures,
        window.lockoutMs,
      );
      if (decision.shouldLock && decision.lockedUntil !== null) {
        await client.query(
          `INSERT INTO auth_lockouts (client_key, failure_count, window_started_at, locked_until, updated_at)
           VALUES ($1, 0, now(), to_timestamp($2 / 1000.0), now())
           ON CONFLICT (client_key) DO UPDATE
           SET locked_until = EXCLUDED.locked_until, failure_count = 0, updated_at = now()`,
          [clientKey, decision.lockedUntil],
        );
        await client.query(`DELETE FROM auth_login_failures WHERE client_key = $1`, [clientKey]);
        return {
          kind: "newly_locked",
          lockedUntil: decision.lockedUntil,
          failuresInWindow: decision.failuresInWindow,
        };
      }

      await client.query(
        `INSERT INTO auth_lockouts (client_key, failure_count, window_started_at, updated_at)
         VALUES ($1, $2, to_timestamp($3 / 1000.0), now())
         ON CONFLICT (client_key) DO UPDATE
         SET failure_count = EXCLUDED.failure_count,
             window_started_at = EXCLUDED.window_started_at,
             updated_at = now()`,
        [clientKey, timestamps.length, timestamps[0] ?? now],
      );
      return { kind: "open", failuresInWindow: decision.failuresInWindow };
    });
  }

  async clearUnderLock(clientKey: string): Promise<void> {
    await withAdvisoryTransaction(this.pool, loginAdvisoryLockKey(clientKey), async (client) => {
      await client.query(`DELETE FROM auth_login_failures WHERE client_key = $1`, [clientKey]);
      await client.query(
        `UPDATE auth_lockouts
         SET locked_until = NULL, failure_count = 0, updated_at = now()
         WHERE client_key = $1`,
        [clientKey],
      );
    });
  }
}

export class PostgresAuditRepository implements AuditRepository {
  constructor(private readonly pool: Pool) {}

  async append(event: {
    kind: AuditKind;
    clientKey: string | null;
    sessionPublicId: string | null;
    meta: Record<string, unknown>;
    at: number;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO audit_events (kind, client_key, session_id, meta, created_at)
       VALUES ($1, $2, $3::uuid, $4::jsonb, to_timestamp($5 / 1000.0))`,
      [
        event.kind,
        event.clientKey,
        event.sessionPublicId,
        JSON.stringify(event.meta),
        event.at,
      ],
    );
  }
}
