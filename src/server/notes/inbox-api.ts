import { E3_DEV_GATES } from "@/domain/inbox/dev-process-gates";
import { inboxErrorBody } from "@/domain/inbox/errors";
import { storedSuggestionsFromJudgment } from "@/domain/inbox/suggestions";
import type { InboxItemRecord, NoteRecord } from "@/domain/notes/types";
import { noteErrorBody } from "@/lib/api/note-contract";
import { jsonResponse } from "@/server/http/json-response";
import {
  JudgmentFailedError,
  TypesafeMisconfiguredError,
} from "@/server/typesafe/runtime";
import { judgmentsForInboxSuggestion } from "./capture-enrichment";
import { handleGetIngestJob, handleListIngestJobs, handleRetryIngestJob } from "./ingest-api";
import { getNotesStore } from "./runtime";
import type { NotesStore } from "./ports";
import { parseListLimit, requireNonEmptyString } from "./validation";

function allowDiscardedOnPromote(): boolean {
  switch (E3_DEV_GATES.promoteWhenDiscarded) {
    case "reject_discarded":
      return false;
    case "allow_and_clear_discard":
      return true;
  }
}

function allowDiscardOfPromoted(): boolean {
  switch (E3_DEV_GATES.discardWhenPromoted) {
    case "reject_promoted":
      return false;
    case "allow_keep_note":
      return true;
  }
}

function judgmentFailure(error: unknown): Response | null {
  if (error instanceof TypesafeMisconfiguredError) {
    return jsonResponse(noteErrorBody("typesafe_misconfigured"), 503);
  }
  if (error instanceof JudgmentFailedError) {
    return jsonResponse(noteErrorBody("judgment_failed"), 502);
  }
  return null;
}

async function refreshSuggestions(
  store: NotesStore,
  item: InboxItemRecord,
): Promise<InboxItemRecord> {
  const judgments = await judgmentsForInboxSuggestion(item.title, item.body);
  const suggestions = storedSuggestionsFromJudgment(
    judgments.suggestions,
    new Date().toISOString(),
  );
  const saved = await store.setInboxSuggestions(item.id, suggestions);
  if (!saved) {
    throw new Error("inbox_missing");
  }
  return saved;
}

async function presentItem(store: NotesStore, item: InboxItemRecord): Promise<InboxItemRecord> {
  switch (E3_DEV_GATES.suggestionDelivery) {
    case "persist_explicit_refresh":
      return item;
    case "recompute_every_read":
      return refreshSuggestions(store, item);
    case "lazy_fill_on_read":
      return item.suggestions ? item : refreshSuggestions(store, item);
  }
}

async function noteForPromoted(store: NotesStore, item: InboxItemRecord): Promise<NoteRecord | null> {
  if (!item.promotedNoteId) {
    return null;
  }
  return store.getNoteById(item.promotedNoteId);
}

function repeatPromoteResponse(
  item: InboxItemRecord,
  note: NoteRecord | null,
): Response {
  switch (E3_DEV_GATES.repeatPromote) {
    case "conflict_already_promoted":
      return jsonResponse(inboxErrorBody("already_promoted"), 409);
    case "idempotent_existing_note":
      if (!note) {
        return jsonResponse(noteErrorBody("not_found"), 404);
      }
      return jsonResponse({ ok: true, inboxItem: item, note }, 200);
  }
}

export async function handleInboxCommand(request: Request): Promise<Response> {
  let body: { action?: unknown; id?: unknown };
  try {
    body = (await request.json()) as { action?: unknown; id?: unknown };
  } catch {
    return jsonResponse(noteErrorBody("validation", { fields: ["action"] }), 400);
  }
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) {
    return jsonResponse(noteErrorBody("validation", { fields: ["id"] }), 400);
  }
  if (body.action === "suggest") {
    return handleRefreshInboxSuggestions(id);
  }
  if (body.action === "retry") {
    return handleRetryIngestJob(id);
  }
  return jsonResponse(noteErrorBody("validation", { fields: ["action"] }), 400);
}

export async function handleListInbox(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (url.searchParams.get("view") === "ingest") {
    const jobId = url.searchParams.get("id");
    if (jobId) {
      return handleGetIngestJob(jobId);
    }
    return handleListIngestJobs(request);
  }
  const itemId = url.searchParams.get("id");
  if (itemId) {
    return handleGetInbox(itemId);
  }
  const limit = parseListLimit(url.searchParams.get("limit"));
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const includeClosed = url.searchParams.get("includeClosed") === "1";
  const store = await getNotesStore();
  const listed = await store.listInboxItems({ limit, cursor, includeClosed });
  try {
    const inboxItems: InboxItemRecord[] = [];
    for (const item of listed.items) {
      inboxItems.push(await presentItem(store, item));
    }
    return jsonResponse({ ok: true, inboxItems, nextCursor: listed.nextCursor }, 200);
  } catch (error) {
    const failed = judgmentFailure(error);
    if (failed) {
      return failed;
    }
    throw error;
  }
}

export async function handleGetInbox(id: string): Promise<Response> {
  const store = await getNotesStore();
  const item = await store.getInboxItemById(id);
  if (!item) {
    return jsonResponse(noteErrorBody("not_found"), 404);
  }
  try {
    const inboxItem = await presentItem(store, item);
    return jsonResponse({ ok: true, inboxItem }, 200);
  } catch (error) {
    const failed = judgmentFailure(error);
    if (failed) {
      return failed;
    }
    throw error;
  }
}

export async function handleRefreshInboxSuggestions(id: string): Promise<Response> {
  const store = await getNotesStore();
  const item = await store.getInboxItemById(id);
  if (!item) {
    return jsonResponse(noteErrorBody("not_found"), 404);
  }
  try {
    const inboxItem = await refreshSuggestions(store, item);
    return jsonResponse({ ok: true, inboxItem }, 200);
  } catch (error) {
    const failed = judgmentFailure(error);
    if (failed) {
      return failed;
    }
    throw error;
  }
}

export async function handlePromoteInbox(id: string): Promise<Response> {
  const store = await getNotesStore();
  const item = await store.getInboxItemById(id);
  if (!item) {
    return jsonResponse(noteErrorBody("not_found"), 404);
  }
  if (item.discardedAt && !allowDiscardedOnPromote()) {
    return jsonResponse(inboxErrorBody("discarded"), 409);
  }
  if (item.promotedNoteId) {
    const note = await noteForPromoted(store, item);
    const fresh = (await store.getInboxItemById(id)) ?? item;
    if (!fresh.promotedNoteId) {
      return promoteOpenItem(store, fresh);
    }
    return repeatPromoteResponse(fresh, note);
  }
  return promoteOpenItem(store, item);
}

async function promoteOpenItem(store: NotesStore, item: InboxItemRecord): Promise<Response> {
  const title = requireNonEmptyString(item.title, "title");
  const body = requireNonEmptyString(item.body, "body");
  const fields = [...(title.ok ? [] : title.fields), ...(body.ok ? [] : body.fields)];
  if (!title.ok || !body.ok) {
    return jsonResponse(noteErrorBody("validation", { fields }), 400);
  }
  const created = await store.promoteInboxItem(
    item.id,
    { title: title.value, body: body.value, status: "draft" },
    { allowDiscarded: allowDiscardedOnPromote() },
  );
  if (created) {
    return jsonResponse({ ok: true, inboxItem: created.inbox, note: created.note }, 200);
  }
  const fresh = await store.getInboxItemById(item.id);
  if (!fresh) {
    return jsonResponse(noteErrorBody("not_found"), 404);
  }
  if (fresh.discardedAt && !allowDiscardedOnPromote()) {
    return jsonResponse(inboxErrorBody("discarded"), 409);
  }
  if (fresh.promotedNoteId) {
    const note = await noteForPromoted(store, fresh);
    return repeatPromoteResponse(fresh, note);
  }
  return jsonResponse(noteErrorBody("not_found"), 404);
}

export async function handleDiscardInbox(id: string): Promise<Response> {
  const store = await getNotesStore();
  const existing = await store.getInboxItemById(id);
  if (!existing) {
    return jsonResponse(noteErrorBody("not_found"), 404);
  }
  if (existing.promotedNoteId && !allowDiscardOfPromoted()) {
    return jsonResponse(inboxErrorBody("already_promoted"), 409);
  }
  const item = await store.discardInboxItem(id, new Date(), {
    allowPromoted: allowDiscardOfPromoted(),
  });
  if (item) {
    return jsonResponse({ ok: true, inboxItem: item }, 200);
  }
  const fresh = await store.getInboxItemById(id);
  if (!fresh) {
    return jsonResponse(noteErrorBody("not_found"), 404);
  }
  if (fresh.promotedNoteId && !allowDiscardOfPromoted()) {
    return jsonResponse(inboxErrorBody("already_promoted"), 409);
  }
  if (fresh.discardedAt) {
    return jsonResponse({ ok: true, inboxItem: fresh }, 200);
  }
  return jsonResponse(noteErrorBody("not_found"), 404);
}
