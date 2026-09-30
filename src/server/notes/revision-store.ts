import type { PoolClient } from "pg";
import type { RevisionReason } from "@/lib/note-revisions";

type Executor = Pick<PoolClient, "query">;
export type RevisionContent = {
  readonly title: string; readonly body: string;
  readonly tags: readonly string[]; readonly aliases: readonly string[];
};

export const REVISION_LIMIT = 50;
const sameList = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);
const sameContent = (a: RevisionContent, b: RevisionContent): boolean =>
  a.title === b.title && a.body === b.body && sameList(a.tags, b.tags) && sameList(a.aliases, b.aliases);

/**
 * Snapshot the state an update is about to replace. Plain edits coalesce into one snapshot
 * per 10 minutes; every other reason always keeps the state it replaced.
 */
export async function recordRevision(
  q: Executor,
  change: { readonly noteId: string; readonly previous: RevisionContent; readonly next: RevisionContent },
  reason: RevisionReason,
): Promise<void> {
  if (sameContent(change.previous, change.next)) return;
  const newest = await q.query<RevisionContent & { recent: boolean }>(
    `SELECT title,body,tags,aliases,created_at > now() - interval '10 minutes' AS recent
       FROM note_revisions WHERE note_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1`,
    [change.noteId],
  );
  const latest = newest.rows[0];
  if (latest && sameContent(latest, change.previous)) return;
  if (latest?.recent && reason === "edit") return;
  const { previous } = change;
  await q.query(
    "INSERT INTO note_revisions (note_id,title,body,tags,aliases,reason) VALUES ($1,$2,$3,$4,$5,$6)",
    [change.noteId, previous.title, previous.body, previous.tags, previous.aliases, reason],
  );
  await q.query(
    `DELETE FROM note_revisions WHERE id IN (
       SELECT id FROM (
         SELECT id,created_at,row_number() OVER (ORDER BY created_at DESC,id DESC) AS rank
           FROM note_revisions WHERE note_id=$1
       ) ranked
       WHERE rank > 1 AND (rank > $2 OR created_at < now() - interval '30 days'))`,
    [change.noteId, REVISION_LIMIT],
  );
}

/** Age out snapshots of notes that were not edited again, keeping each note's newest one. */
export async function pruneAgedRevisions(q: Executor): Promise<void> {
  await q.query(
    `DELETE FROM note_revisions r WHERE r.created_at < now() - interval '30 days'
       AND EXISTS (SELECT 1 FROM note_revisions newer
                    WHERE newer.note_id=r.note_id AND (newer.created_at,newer.id) > (r.created_at,r.id))`,
  );
}
