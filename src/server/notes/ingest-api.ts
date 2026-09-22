import { E3_DEV_GATES } from "@/domain/inbox/dev-process-gates";
import { inboxErrorBody } from "@/domain/inbox/errors";
import { storedSuggestionsFromJudgment } from "@/domain/inbox/suggestions";
import type { IngestJobRecord } from "@/domain/notes/types";
import { noteErrorBody } from "@/lib/api/note-contract";
import { jsonResponse } from "@/server/http/json-response";
import {
  JudgmentFailedError,
  TypesafeMisconfiguredError,
} from "@/server/typesafe/runtime";
import { inboxClassificationEnabled, judgmentsForCapture } from "./capture-enrichment";
import type { IngestJobListStatus, NotesStore } from "./ports";
import { getNotesStore } from "./runtime";
import { summarizeUrl } from "./url-summary";
import { parseListLimit } from "./validation";

const JOB_STATUSES = new Set<IngestJobListStatus>(["pending", "failed", "done", "all"]);

function parseStatus(raw: string | null): IngestJobListStatus | null {
  if (!raw) {
    return "failed";
  }
  return JOB_STATUSES.has(raw as IngestJobListStatus) ? (raw as IngestJobListStatus) : null;
}

function retryTarget(payload: Record<string, unknown>): "note" | "inbox" {
  switch (E3_DEV_GATES.ingestRetryTarget) {
    case "always_inbox":
      return "inbox";
    case "honor_stored_target":
      return payload.target === "note" || payload.target === "inbox" ? payload.target : "inbox";
  }
}

function retryPlan(job: IngestJobRecord): { url: string; title: string; target: "note" | "inbox" } | null {
  if (job.kind !== "url_summary") {
    return null;
  }
  const url = typeof job.payload.url === "string" ? job.payload.url.trim() : "";
  const title = typeof job.payload.title === "string" ? job.payload.title.trim() : "";
  if (!url || !title) {
    return null;
  }
  return { url, title, target: retryTarget(job.payload) };
}

async function failJob(
  store: NotesStore,
  job: IngestJobRecord,
  error: string,
): Promise<IngestJobRecord> {
  const updated = await store.updateIngestJob(job.id, {
    status: "failed",
    error,
    payload: job.payload,
  });
  return updated ?? { ...job, status: "failed", error };
}

export async function handleListIngestJobs(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const status = parseStatus(url.searchParams.get("status"));
  if (!status) {
    return jsonResponse(noteErrorBody("validation", { fields: ["status"] }), 400);
  }
  const store = await getNotesStore();
  const result = await store.listIngestJobs({
    limit: parseListLimit(url.searchParams.get("limit")),
    cursor: url.searchParams.get("cursor") ?? undefined,
    status,
  });
  return jsonResponse({ ok: true, jobs: result.jobs, nextCursor: result.nextCursor }, 200);
}

export async function handleGetIngestJob(id: string): Promise<Response> {
  const store = await getNotesStore();
  const job = await store.getIngestJobById(id);
  if (!job) {
    return jsonResponse(noteErrorBody("not_found"), 404);
  }
  return jsonResponse({ ok: true, job }, 200);
}

export async function handleRetryIngestJob(id: string): Promise<Response> {
  const store = await getNotesStore();
  const existing = await store.getIngestJobById(id);
  if (!existing) {
    return jsonResponse(noteErrorBody("not_found"), 404);
  }
  if (existing.status !== "failed") {
    return jsonResponse(inboxErrorBody("not_failed"), 409);
  }
  const plan = retryPlan(existing);
  if (!plan) {
    return jsonResponse(inboxErrorBody("not_retriable"), 409);
  }
  const claimed = await store.claimFailedIngestJob(id);
  if (!claimed) {
    return jsonResponse(inboxErrorBody("not_failed"), 409);
  }

  const summary = await summarizeUrl(plan.url);
  if (!summary.ok) {
    await failJob(store, claimed, summary.error);
    return jsonResponse(noteErrorBody("ingest_failed", { jobId: id }), 502);
  }

  try {
    const includeClassification = plan.target === "inbox" && inboxClassificationEnabled();
    const judgments = await judgmentsForCapture(store, plan.title, summary.summary, {
      includeClassification,
    });
    if (plan.target === "note") {
      const note = await store.createNote({
        title: plan.title,
        body: summary.summary,
        status: "draft",
      });
      const job = await store.updateIngestJob(id, {
        status: "done",
        error: null,
        payload: { ...claimed.payload, target: plan.target, createdNoteId: note.id },
      });
      return jsonResponse(
        {
          ok: true,
          job,
          target: "note",
          note,
          suggestions: judgments.suggestions,
          duplicateHint: judgments.duplicateHint,
        },
        200,
      );
    }
    const inboxItem = await store.createInboxItem({
      title: plan.title,
      body: summary.summary,
      source: "url",
      url: plan.url,
      suggestions: storedSuggestionsFromJudgment(judgments.suggestions, new Date().toISOString()),
    });
    const job = await store.updateIngestJob(id, {
      status: "done",
      error: null,
      payload: { ...claimed.payload, target: plan.target, createdInboxItemId: inboxItem.id },
    });
    return jsonResponse(
      {
        ok: true,
        job,
        target: "inbox",
        inboxItem,
        suggestions: judgments.suggestions,
        duplicateHint: judgments.duplicateHint,
      },
      200,
    );
  } catch (error) {
    if (error instanceof TypesafeMisconfiguredError) {
      await failJob(store, claimed, "typesafe_misconfigured");
      return jsonResponse(noteErrorBody("typesafe_misconfigured", { jobId: id }), 503);
    }
    if (error instanceof JudgmentFailedError) {
      await failJob(store, claimed, "judgment_failed");
      return jsonResponse(noteErrorBody("judgment_failed", { jobId: id }), 502);
    }
    await failJob(store, claimed, "ingest_failed");
    throw error;
  }
}
