import { getDb } from "../../db/client";

const WINDOW_MS = 15 * 60 * 1000;
const FAILURE_LIMIT = 5;
type LockRow = { readonly locked_until: Date };

export type LockStatus =
  | { readonly locked: true; readonly lockedUntil: Date }
  | { readonly locked: false; readonly lockedUntil: null };

export async function recordFailure(ip: string, now = new Date()): Promise<LockStatus> {
  return getDb().begin(async (sql): Promise<LockStatus> => {
    // Serialize the count-and-lock decision across workers, even for a new IP.
    await sql`SELECT pg_advisory_xact_lock(hashtext(current_schema()), hashtext(${'brain:login:' + ip}))`;
    const [active] = await sql<LockRow[]>`
      SELECT locked_until FROM login_locks WHERE ip = ${ip} AND locked_until > ${now}
    `;
    if (active) return { locked: true, lockedUntil: active.locked_until };

    await sql`INSERT INTO login_failures (ip, attempted_at) VALUES (${ip}, ${now})`;
    const [failures] = await sql<[{ readonly count: number }]>`
      SELECT count(*)::integer AS count FROM login_failures
      WHERE ip = ${ip} AND attempted_at > ${new Date(now.getTime() - WINDOW_MS)} AND attempted_at <= ${now}
    `;
    if (failures.count < FAILURE_LIMIT) return { locked: false, lockedUntil: null };

    const lockedUntil = new Date(now.getTime() + WINDOW_MS);
    await sql`
      INSERT INTO login_locks (ip, locked_until) VALUES (${ip}, ${lockedUntil})
      ON CONFLICT (ip) DO UPDATE SET locked_until = EXCLUDED.locked_until
    `;
    return { locked: true, lockedUntil };
  });
}

export async function lockStatus(ip: string, now = new Date()): Promise<LockStatus> {
  const [active] = await getDb()<LockRow[]>`
    SELECT locked_until FROM login_locks WHERE ip = ${ip} AND locked_until > ${now}
  `;
  return active ? { locked: true, lockedUntil: active.locked_until } : { locked: false, lockedUntil: null };
}

export async function clearFailures(ip: string): Promise<void> {
  await getDb().begin(async (sql) => {
    await sql`SELECT pg_advisory_xact_lock(hashtext(current_schema()), hashtext(${'brain:login:' + ip}))`;
    await sql`DELETE FROM login_failures WHERE ip = ${ip}`;
    await sql`DELETE FROM login_locks WHERE ip = ${ip}`;
  });
}
