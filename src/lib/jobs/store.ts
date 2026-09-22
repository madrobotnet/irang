import { randomUUID } from "node:crypto";
import { getDb } from "../../db/client";

export type AiJob = {
  readonly id: string;
  readonly kind: string;
  readonly status: string;
  readonly error: string | null;
  readonly attempts: number;
  readonly payload: unknown;
};

export async function recordFailedJob(kind: string, error: string, payload: unknown, now = new Date()): Promise<string> {
  const id = randomUUID();
  const sql = getDb();
  await sql`
    INSERT INTO ai_jobs (id, kind, status, error, attempts, payload, created_at, updated_at)
    VALUES (${id}, ${kind}, 'failed', ${error}, 1, ${sql.json(payload as never)}, ${now}, ${now})
  `;
  return id;
}

export async function listFailedJobs(): Promise<readonly AiJob[]> {
  const rows = await getDb()`
    SELECT id, kind, status, error, attempts, payload
    FROM ai_jobs WHERE status = 'failed' ORDER BY created_at DESC
  `;
  return rows.map((row) => ({
    id: String(row["id"]),
    kind: String(row["kind"]),
    status: String(row["status"]),
    error: row["error"] === null ? null : String(row["error"]),
    attempts: Number(row["attempts"]),
    payload: row["payload"],
  }));
}

export async function markJob(id: string, status: "failed" | "succeeded", error: string | null, now = new Date()): Promise<void> {
  await getDb()`
    UPDATE ai_jobs
    SET status = ${status}, error = ${error}, attempts = attempts + 1, updated_at = ${now}
    WHERE id = ${id}
  `;
}
