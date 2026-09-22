import { applySecurityHeaders } from "@/lib/auth/security-headers";
import { noteErrorBody } from "@/lib/api/note-contract";
import { E3_DEV_GATES } from "@/domain/inbox/dev-process-gates";
import { storedSuggestionsFromJudgment } from "@/domain/inbox/suggestions";
import type { NoteStatus } from "@/domain/notes/constants";
import { getNotesStore } from "./runtime";
import { purgeAtFrom } from "./memory-store";
import {
  attachmentTooLarge,
  isAllowedAttachment,
  parseListLimit,
  parseNoteStatus,
  requireNonEmptyString,
} from "./validation";
import { summarizeUrl } from "./url-summary";
import {
  deleteAttachmentFile,
  readAttachmentFile,
  storeAttachmentFile,
} from "./attachment-storage";
import { inboxClassificationEnabled, judgmentsForCapture } from "./capture-enrichment";
import {
  JudgmentFailedError,
  TypesafeMisconfiguredError,
} from "@/server/typesafe/runtime";
function json(body: unknown, status: number): Response {
  const headers = new Headers({ "content-type": "application/json; charset=utf-8" });
  applySecurityHeaders(headers);
  return new Response(JSON.stringify(body), { status, headers });
}

function parseLimit(raw: string | null): number {
  return parseListLimit(raw);
}

function isPurged(note: { purgeAt: string | null }): boolean {
  if (!note.purgeAt) {
    return false;
  }
  return new Date(note.purgeAt) <= new Date();
}

export async function handleCreateNote(request: Request): Promise<Response> {
  const body = (await request.json()) as {
    title?: unknown;
    body?: unknown;
    status?: unknown;
  };
  const title = requireNonEmptyString(body.title, "title");
  const text = requireNonEmptyString(body.body, "body");
  const fields = [
    ...(title.ok ? [] : title.fields),
    ...(text.ok ? [] : text.fields),
  ];
  if (fields.length || !title.ok || !text.ok) {
    return json(noteErrorBody("validation", { fields }), 400);
  }
  let status: NoteStatus = "draft";
  if (body.status !== undefined) {
    const parsed = parseNoteStatus(body.status);
    if (!parsed) {
      return json(noteErrorBody("validation", { fields: ["status"] }), 400);
    }
    status = parsed;
  }
  const store = await getNotesStore();
  const note = await store.createNote({
    title: title.value,
    body: text.value,
    status,
  });
  return json({ ok: true, note }, 201);
}

export async function handleListNotes(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const limit = parseLimit(url.searchParams.get("limit"));
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const statusParam = url.searchParams.get("status");
  const status = statusParam ? parseNoteStatus(statusParam) : undefined;
  if (statusParam && !status) {
    return json(noteErrorBody("validation", { fields: ["status"] }), 400);
  }
  const includeDeleted = url.searchParams.get("includeDeleted") === "1";
  const store = await getNotesStore();
  const result = await store.listNotes({
    limit,
    cursor,
    status: status ?? undefined,
    includeDeleted,
  });
  return json({ ok: true, notes: result.notes, nextCursor: result.nextCursor }, 200);
}

export async function handleGetNote(id: string): Promise<Response> {
  const store = await getNotesStore();
  const note = await store.getNoteById(id);
  if (!note) {
    return json(noteErrorBody("not_found"), 404);
  }
  if (isPurged(note)) {
    return json(noteErrorBody("not_found"), 404);
  }
  return json({ ok: true, note }, 200);
}

export async function handlePatchNote(id: string, request: Request): Promise<Response> {
  const store = await getNotesStore();
  const existing = await store.getNoteById(id);
  if (!existing) {
    return json(noteErrorBody("not_found"), 404);
  }
  if (isPurged(existing)) {
    return json(noteErrorBody("purged"), 410);
  }
  if (existing.deletedAt) {
    return json(noteErrorBody("deleted"), 409);
  }
  const body = (await request.json()) as {
    title?: unknown;
    body?: unknown;
    status?: unknown;
  };
  const patch: { title?: string; body?: string; status?: NoteStatus } = {};
  const fields: string[] = [];
  if (body.title !== undefined) {
    const t = requireNonEmptyString(body.title, "title");
    if (!t.ok) {
      fields.push(...t.fields);
    } else {
      patch.title = t.value;
    }
  }
  if (body.body !== undefined) {
    const b = requireNonEmptyString(body.body, "body");
    if (!b.ok) {
      fields.push(...b.fields);
    } else {
      patch.body = b.value;
    }
  }
  if (body.status !== undefined) {
    const s = parseNoteStatus(body.status);
    if (!s) {
      fields.push("status");
    } else {
      patch.status = s;
    }
  }
  if (fields.length) {
    return json(noteErrorBody("validation", { fields }), 400);
  }
  const note = await store.updateNote(id, patch);
  if (!note) {
    return json(noteErrorBody("not_found"), 404);
  }
  return json({ ok: true, note }, 200);
}

export async function handleDeleteNote(id: string): Promise<Response> {
  const store = await getNotesStore();
  const existing = await store.getNoteById(id);
  if (!existing || isPurged(existing)) {
    return json(noteErrorBody("not_found"), 404);
  }
  if (existing.deletedAt) {
    return json({ ok: true, note: existing }, 200);
  }
  const deletedAt = new Date();
  const purgeAt = purgeAtFrom(deletedAt);
  const note = await store.softDeleteNote(id, deletedAt, purgeAt);
  if (!note) {
    return json(noteErrorBody("not_found"), 404);
  }
  return json({ ok: true, note }, 200);
}

export async function handleRestoreNote(id: string): Promise<Response> {
  const store = await getNotesStore();
  const existing = await store.peekNoteById(id);
  if (!existing) {
    return json(noteErrorBody("not_found"), 404);
  }
  if (isPurged(existing)) {
    await store.hardDeleteNote(id);
    return json(noteErrorBody("purged"), 410);
  }
  if (!existing.deletedAt) {
    return json(noteErrorBody("not_deleted"), 409);
  }
  const note = await store.restoreNote(id);
  if (!note) {
    return json(noteErrorBody("not_found"), 404);
  }
  return json({ ok: true, note }, 200);
}

export async function handleCapture(request: Request): Promise<Response> {
  const body = (await request.json()) as {
    title?: unknown;
    body?: unknown;
    target?: unknown;
    url?: unknown;
  };
  const title = requireNonEmptyString(body.title, "title");
  const text = requireNonEmptyString(body.body, "body");
  const fields = [
    ...(title.ok ? [] : title.fields),
    ...(text.ok ? [] : text.fields),
  ];
  if (fields.length || !title.ok || !text.ok) {
    return json(noteErrorBody("validation", { fields }), 400);
  }
  const target = body.target;
  if (target !== "note" && target !== "inbox") {
    return json(noteErrorBody("validation", { fields: ["target"] }), 400);
  }

  let finalBody = text.value;
  const url =
    typeof body.url === "string" && body.url.trim() ? body.url.trim() : null;
  if (url) {
    const summary = await summarizeUrl(url);
    if (!summary.ok) {
      const store = await getNotesStore();
      const job = await store.createIngestJob({
        kind: "url_summary",
        status: "failed",
        payload: { url, title: title.value, body: text.value, target },
        error: summary.error,
      });
      return json(noteErrorBody("ingest_failed", { jobId: job.id }), 502);
    }
    finalBody = summary.summary;
  }

  const store = await getNotesStore();
  let judgments;
  try {
    judgments = await judgmentsForCapture(store, title.value, finalBody, {
      includeClassification:
        target === "inbox" && E3_DEV_GATES.classificationShape === "choice_plus_tag_nouls",
    });
  } catch (error) {
    if (error instanceof TypesafeMisconfiguredError) {
      return json(noteErrorBody("typesafe_misconfigured"), 503);
    }
    if (error instanceof JudgmentFailedError) {
      return json(noteErrorBody("judgment_failed"), 502);
    }
    throw error;
  }

  if (target === "note") {
    const note = await store.createNote({
      title: title.value,
      body: finalBody,
      status: "draft",
    });
    return json(
      {
        ok: true,
        target: "note",
        note,
        suggestions: judgments.suggestions,
        duplicateHint: judgments.duplicateHint,
      },
      201,
    );
  }
  const inboxItem = await store.createInboxItem({
    title: title.value,
    body: finalBody,
    source: url ? "url" : "api",
    url,
    suggestions: storedSuggestionsFromJudgment(judgments.suggestions, new Date().toISOString()),
  });
  return json(
    {
      ok: true,
      target: "inbox",
      inboxItem,
      suggestions: judgments.suggestions,
      duplicateHint: judgments.duplicateHint,
    },
    201,
  );
}

export async function handleCaptureShare(request: Request): Promise<Response> {
  const contentType = request.headers.get("content-type") ?? "";
  let title: string | undefined;
  let text: string | undefined;
  let url: string | undefined;
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    title = typeof form.get("title") === "string" ? form.get("title") as string : undefined;
    text = typeof form.get("text") === "string" ? form.get("text") as string : undefined;
    url = typeof form.get("url") === "string" ? form.get("url") as string : undefined;
  } else {
    const body = (await request.json()) as { title?: unknown; text?: unknown; url?: unknown };
    title = typeof body.title === "string" ? body.title : undefined;
    text = typeof body.text === "string" ? body.text : undefined;
    url = typeof body.url === "string" ? body.url : undefined;
  }
  const hasTitle = title?.trim();
  const hasText = text?.trim();
  const hasUrl = url?.trim();
  if (!hasTitle && !hasText && !hasUrl) {
    return json(noteErrorBody("validation"), 400);
  }
  const store = await getNotesStore();
  const captureTitle = hasTitle || hasText?.slice(0, 120) || hasUrl || "Shared item";
  const captureBody = hasText || hasUrl || "";
  let judgments;
  try {
    judgments = await judgmentsForCapture(store, captureTitle, captureBody, {
      includeClassification: inboxClassificationEnabled(),
    });
  } catch (error) {
    if (error instanceof TypesafeMisconfiguredError) {
      return json(noteErrorBody("typesafe_misconfigured"), 503);
    }
    if (error instanceof JudgmentFailedError) {
      return json(noteErrorBody("judgment_failed"), 502);
    }
    throw error;
  }
  const inboxItem = await store.createInboxItem({
    title: captureTitle,
    body: captureBody,
    source: "share",
    url: hasUrl || null,
    suggestions: storedSuggestionsFromJudgment(judgments.suggestions, new Date().toISOString()),
  });
  return json(
    {
      ok: true,
      inboxItem,
      suggestions: judgments.suggestions,
      duplicateHint: judgments.duplicateHint,
    },
    201,
  );
}

export {
  handleDiscardInbox,
  handleGetInbox,
  handleInboxCommand,
  handleListInbox,
  handlePromoteInbox,
  handleRefreshInboxSuggestions,
} from "./inbox-api";

export async function handleUploadAttachment(request: Request): Promise<Response> {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return json(noteErrorBody("validation", { fields: ["file"] }), 400);
  }
  const noteId = typeof form.get("noteId") === "string" ? (form.get("noteId") as string) : null;
  const inboxItemId =
    typeof form.get("inboxItemId") === "string" ? (form.get("inboxItemId") as string) : null;
  if (!noteId && !inboxItemId) {
    return json(noteErrorBody("validation", { fields: ["noteId", "inboxItemId"] }), 400);
  }
  const store = await getNotesStore();
  if (noteId) {
    const note = await store.getNoteById(noteId);
    if (!note || isPurged(note)) {
      return json(noteErrorBody("not_found"), 404);
    }
  }
  if (inboxItemId) {
    const item = await store.getInboxItemById(inboxItemId);
    if (!item) {
      return json(noteErrorBody("not_found"), 404);
    }
  }
  if (attachmentTooLarge(file.size)) {
    return json(noteErrorBody("payload_too_large"), 413);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (attachmentTooLarge(bytes.length)) {
    return json(noteErrorBody("payload_too_large"), 413);
  }
  const mime = file.type || "application/octet-stream";
  if (!isAllowedAttachment(file.name, mime)) {
    return json(noteErrorBody("unsupported_media"), 415);
  }
  let storageKey: string;
  try {
    storageKey = await storeAttachmentFile(file.name, bytes);
  } catch {
    return json(noteErrorBody("misconfigured"), 503);
  }
  const attachment = await store.createAttachment({
    noteId,
    inboxItemId,
    filename: file.name,
    mime: mime.split(";")[0]?.trim() || mime,
    sizeBytes: bytes.length,
    storageKey,
  });
  return json({ ok: true, attachment }, 201);
}

export async function handleGetAttachment(id: string): Promise<Response> {
  const store = await getNotesStore();
  const record = await store.getAttachmentById(id);
  if (!record) {
    return json(noteErrorBody("not_found"), 404);
  }
  let bytes: Uint8Array;
  try {
    bytes = await readAttachmentFile(record.storageKey);
  } catch {
    return json(noteErrorBody("not_found"), 404);
  }
  const headers = new Headers({
    "content-type": record.mime,
    "content-disposition": `attachment; filename="${record.filename.replace(/"/g, "")}"`,
    "content-length": String(bytes.length),
  });
  applySecurityHeaders(headers);
  return new Response(Buffer.from(bytes), { status: 200, headers });
}

export async function handleDeleteAttachment(id: string): Promise<Response> {
  const store = await getNotesStore();
  const record = await store.getAttachmentById(id);
  if (!record) {
    return json(noteErrorBody("not_found"), 404);
  }
  await deleteAttachmentFile(record.storageKey);
  await store.deleteAttachment(id);
  return json({ ok: true }, 200);
}

