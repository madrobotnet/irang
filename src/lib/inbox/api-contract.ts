/**
 * Rex inbox contract (E3):
 * GET  /api/inbox
 * GET  /api/inbox?view=ingest
 * POST /api/inbox  { action: "suggest" | "retry", id }
 * POST /api/inbox/:id/promote
 * POST /api/inbox/:id/discard
 */

import type { InboxFailureReason } from "./types";
import { mapJudgmentCode } from "./parse";

export const INBOX_API = {
  list: "/api/inbox",
  ingest: "/api/inbox?view=ingest",
  command: "/api/inbox",
  promote: (id: string) => `/api/inbox/${encodeURIComponent(id)}/promote`,
  discard: (id: string) => `/api/inbox/${encodeURIComponent(id)}/discard`,
} as const;

export function mapInboxFailure(
  status: number,
  code: string | undefined,
): InboxFailureReason {
  const judgment = mapJudgmentCode(code);
  if (judgment) return judgment;
  if (code === "ingest_failed") return "ingest_failed";
  if (code === "already_promoted") return "already_promoted";
  if (code === "discarded") return "discarded";
  if (code === "not_failed") return "not_failed";
  if (code === "not_retriable") return "not_retriable";
  if (code === "validation") return "validation";
  if (code === "unauthorized" || status === 401) return "unauthorized";
  if (code === "not_found" || status === 404) return "not_found";
  if (status === 502) return "ingest_failed";
  if (status === 0) return "network";
  return "server";
}
