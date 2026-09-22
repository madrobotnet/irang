import { INBOX_API, mapInboxFailure } from "./api-contract";
import { parseInboxItem, parseInboxListBody, parseIngestJobsBody } from "./parse";
import type { InboxFailureReason, InboxItem, IngestJobView } from "./types";

export type InboxListResult =
  | { ok: true; items: InboxItem[] }
  | { ok: false; reason: InboxFailureReason };

export type IngestListResult =
  | { ok: true; jobs: IngestJobView[] }
  | { ok: false; reason: InboxFailureReason };

export type SuggestResult =
  | { ok: true; item: InboxItem }
  | { ok: false; reason: InboxFailureReason };

export type PromoteResult =
  | { ok: true; noteId: string | null }
  | { ok: false; reason: InboxFailureReason };

export type DiscardResult =
  | { ok: true }
  | { ok: false; reason: InboxFailureReason };

export type RetryIngestResult =
  | { ok: true }
  | { ok: false; reason: InboxFailureReason };

type FailBody = {
  ok?: boolean;
  code?: string;
  inboxItem?: unknown;
  note?: { id?: string };
};

async function readBody(res: Response): Promise<FailBody | null> {
  const text = await res.text();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as FailBody;
  } catch {
    return null;
  }
}

export async function listInbox(fetchImpl: typeof fetch = fetch): Promise<InboxListResult> {
  try {
    const res = await fetchImpl(INBOX_API.list, { credentials: "include" });
    const body = await readBody(res);
    if (!res.ok || !body || body.ok === false) {
      return { ok: false, reason: mapInboxFailure(res.status, body?.code) };
    }
    const items = parseInboxListBody(body);
    if (!items) return { ok: false, reason: "server" };
    return { ok: true, items };
  } catch {
    return { ok: false, reason: "network" };
  }
}

export async function listIngestFailures(
  fetchImpl: typeof fetch = fetch,
): Promise<IngestListResult> {
  try {
    const res = await fetchImpl(INBOX_API.ingest, { credentials: "include" });
    const body = await readBody(res);
    if (!res.ok || !body || body.ok === false) {
      return { ok: false, reason: mapInboxFailure(res.status, body?.code) };
    }
    const jobs = parseIngestJobsBody(body);
    if (!jobs) return { ok: false, reason: "server" };
    return { ok: true, jobs };
  } catch {
    return { ok: false, reason: "network" };
  }
}

/** Explicit refresh. A failure response carries no tags to display. */
export async function suggestInbox(
  id: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SuggestResult> {
  try {
    const res = await fetchImpl(INBOX_API.command, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "suggest", id }),
    });
    const body = await readBody(res);
    if (!res.ok || !body || body.ok === false) {
      return { ok: false, reason: mapInboxFailure(res.status, body?.code) };
    }
    const item = parseInboxItem(body.inboxItem);
    if (!item) return { ok: false, reason: "server" };
    return { ok: true, item };
  } catch {
    return { ok: false, reason: "network" };
  }
}

/**
 * Promote uses the stored title and body. The route ignores a JSON body,
 * and suggestions are not copied onto the note.
 */
export async function promoteInbox(
  id: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PromoteResult> {
  try {
    const res = await fetchImpl(INBOX_API.promote(id), {
      method: "POST",
      credentials: "include",
    });
    const body = await readBody(res);
    if (!res.ok || !body || body.ok === false) {
      const reason = mapInboxFailure(res.status, body?.code);
      if (reason === "network" || reason === "unauthorized" || reason === "not_found") {
        return { ok: false, reason };
      }
      return { ok: false, reason: "promote_failed" };
    }
    const noteId = typeof body.note?.id === "string" ? body.note.id : null;
    return { ok: true, noteId };
  } catch {
    return { ok: false, reason: "network" };
  }
}

export async function discardInbox(
  id: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DiscardResult> {
  try {
    const res = await fetchImpl(INBOX_API.discard(id), {
      method: "POST",
      credentials: "include",
    });
    const body = await readBody(res);
    if (!res.ok || !body || body.ok === false) {
      const reason = mapInboxFailure(res.status, body?.code);
      if (reason === "network" || reason === "unauthorized" || reason === "not_found") {
        return { ok: false, reason };
      }
      return { ok: false, reason: "discard_failed" };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "network" };
  }
}

export async function retryIngest(
  id: string,
  fetchImpl: typeof fetch = fetch,
): Promise<RetryIngestResult> {
  try {
    const res = await fetchImpl(INBOX_API.command, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "retry", id }),
    });
    const body = await readBody(res);
    if (!res.ok || !body || body.ok === false) {
      return { ok: false, reason: mapInboxFailure(res.status, body?.code) };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "network" };
  }
}
