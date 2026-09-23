import type { Pool, PoolClient } from "pg";

/** Shared with every worker so session-cap decisions cannot interleave. */
export const SESSION_ADVISORY_LOCK_KEY = "brain:sessions";

/** Per-client lock so login failure counts cannot interleave across workers. */
export function loginAdvisoryLockKey(clientKey: string): string {
  return `brain:login:${clientKey}`;
}

export async function withAdvisoryTransaction<T>(
  pool: Pool,
  lockKey: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext(current_schema()), hashtext($1))",
      [lockKey],
    );
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // The original error is the one callers need.
    }
    throw error;
  } finally {
    client.release();
  }
}
