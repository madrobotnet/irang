import { Pool } from "pg";
import { validateDatabaseUrl } from "./database-url";

/** Idempotent auth DDL only — never DROP sessions (or other live tables) on boot. */
const SCHEMA_SQL = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    bytea NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  revoked_at    timestamptz NULL,
  user_agent    text NULL,
  ip            inet NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_hash_uidx ON sessions (token_hash);
CREATE INDEX IF NOT EXISTS sessions_user_active_idx
  ON sessions (user_id, created_at)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS auth_lockouts (
  client_key        text PRIMARY KEY,
  failure_count     int NOT NULL DEFAULT 0,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  locked_until      timestamptz NULL,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_login_failures (
  client_key    text NOT NULL,
  attempted_at  timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_login_failures_client_time_idx
  ON auth_login_failures (client_key, attempted_at);

CREATE TABLE IF NOT EXISTS audit_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          text NOT NULL,
  client_key    text NULL,
  session_id    uuid NULL,
  meta          jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_events_created_idx ON audit_events (created_at DESC);
`;

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

export function getPool(databaseUrl: string): Pool {
  validateDatabaseUrl(databaseUrl);
  if (!pool) {
    pool = new Pool({ connectionString: databaseUrl });
  }
  return pool;
}

export async function ensureAuthSchema(databaseUrl: string): Promise<void> {
  if (!schemaReady) {
    const pending = (async () => {
      const client = getPool(databaseUrl);
      await client.query(SCHEMA_SQL);
    })();
    schemaReady = pending;
    try {
      await pending;
    } catch (error) {
      schemaReady = null;
      throw error;
    }
    return;
  }
  await schemaReady;
}

export function resetPoolForTests(): void {
  if (pool) {
    void pool.end();
  }
  pool = null;
  schemaReady = null;
}
