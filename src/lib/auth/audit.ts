import type postgres from "postgres";
import { getDb } from "../../db/client";

export async function writeAudit(action: string, ip: string | null, meta: postgres.JSONValue = {}): Promise<void> {
  const sql = getDb();
  await sql`INSERT INTO audit_events (action, ip, meta) VALUES (${action}, ${ip}, ${sql.json(meta)})`;
}
