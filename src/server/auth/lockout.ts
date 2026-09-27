import { query, queryOne } from "@/server/db";
import { LOGIN_FAIL_LIMIT, LOGIN_FAIL_WINDOW_MIN } from "./config";

/** Seconds until the client may try again, or 0 when not locked. */
export async function lockedForSeconds(clientKey: string): Promise<number> {
  const row = await queryOne<{ n: string; oldest: Date | null }>(
    `SELECT count(*)::text AS n, min(attempted_at) AS oldest FROM auth_login_failures
      WHERE client_key = $1 AND attempted_at > now() - make_interval(mins => $2)`,
    [clientKey, LOGIN_FAIL_WINDOW_MIN],
  );
  if (!row || Number(row.n) < LOGIN_FAIL_LIMIT || !row.oldest) return 0;
  const unlockAt = row.oldest.getTime() + LOGIN_FAIL_WINDOW_MIN * 60_000;
  return Math.max(1, Math.ceil((unlockAt - Date.now()) / 1000));
}

export async function recordFailure(clientKey: string): Promise<void> {
  await query("INSERT INTO auth_login_failures (client_key, attempted_at) VALUES ($1, now())", [clientKey]);
  await query("DELETE FROM auth_login_failures WHERE attempted_at < now() - interval '1 day'");
}

export async function clearFailures(clientKey: string): Promise<void> {
  await query("DELETE FROM auth_login_failures WHERE client_key = $1", [clientKey]);
}
