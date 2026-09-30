import { db, query, tx } from "@/server/db";
import { retryAttachmentCleanup } from "./attachment-cleanup";
import { pruneAgedRevisions } from "./revision-store";
import { purgeInTransaction, type PurgeScope } from "./service";

export const TRASH_LIST_PURGE_BATCH = 20;
export const STARTUP_PURGE_BATCH = 500;

type PurgeOutcome = { purged: number; errors: unknown[] };

// One transaction per note keeps a single failing note from starving the rest.
async function purgeEach(ids: readonly string[], scope: PurgeScope): Promise<PurgeOutcome> {
  const outcome: PurgeOutcome = { purged: 0, errors: [] };
  try {
    for (const id of ids) {
      try {
        if (await tx((client) => purgeInTransaction(client, id, scope))) outcome.purged += 1;
      } catch (error) {
        outcome.errors.push(error);
      }
    }
  } finally {
    await retryAttachmentCleanup();
  }
  return outcome;
}

const errorCode = (error: unknown): string =>
  error instanceof Error && "code" in error && typeof error.code === "string" ? error.code : "unknown";

/** Best-effort retention sweep: purges up to `limit` notes whose 30-day trash period ended; never throws. */
export async function purgeExpired(limit: number): Promise<number> {
  try {
    const rows = await query<{ id: string }>(
      `SELECT id FROM notes WHERE deleted_at IS NOT NULL AND purge_at <= now()
        ORDER BY purge_at,id LIMIT $1`,
      [limit],
    );
    const { purged, errors } = await purgeEach(rows.map((row) => row.id), "expired");
    if (errors.length) console.warn("[trash] auto-purge deferred", { failures: errors.length, code: errorCode(errors[0]) });
    return purged;
  } catch (error) {
    console.warn("[trash] auto-purge deferred", { failures: 1, code: errorCode(error) });
    return 0;
  }
}

export async function emptyTrash(): Promise<{ purged: number }> {
  const rows = await query<{ id: string }>("SELECT id FROM notes WHERE deleted_at IS NOT NULL ORDER BY deleted_at,id");
  const { purged, errors } = await purgeEach(rows.map((row) => row.id), "trashed");
  if (errors[0] !== undefined) throw errors[0];
  return { purged };
}

export async function runNoteMaintenance(): Promise<void> {
  await retryAttachmentCleanup();
  await purgeExpired(STARTUP_PURGE_BATCH);
  try {
    await pruneAgedRevisions(await db());
  } catch (error) {
    console.warn("[revisions] pruning deferred", { code: errorCode(error) });
  }
}
