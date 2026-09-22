import type { NoteApiErrorCode } from "@/lib/api/note-contract";
import type { CaptureInboxOk, CaptureNoteOk } from "@/lib/api/note-dto";
import type { CaptureJudgments } from "@/lib/judgments";
import { parseCaptureJudgmentFields, wireDuplicateHintToBoolean } from "@/lib/judgments";
import {
  API_SUCCESS_STATUS,
  ATTACHMENTS_API,
  CAPTURE_API,
  mapNoteApiFailure,
  NOTES_API,
} from "./api-contract";
import type {
  CreateNoteInput,
  Note,
  NoteListResponse,
  UpdateNoteInput,
} from "./types";

export class NotesApiError extends Error {
  constructor(
    readonly code: NoteApiErrorCode,
    readonly status: number,
    readonly fields?: string[],
  ) {
    super(code);
    this.name = "NotesApiError";
  }
}

type ApiFail = {
  ok: false;
  code?: NoteApiErrorCode;
  fields?: string[];
  jobId?: string;
};

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

function failFromResponse(res: Response, body: ApiFail): NotesApiError {
  const code = mapNoteApiFailure(res.status, body.code);
  return new NotesApiError(code, res.status, body.fields);
}

async function expectOk<T extends { ok: true }>(
  res: Response,
  expectedStatus: number,
): Promise<T> {
  const body = await parseJson<T | ApiFail>(res);
  if (res.status !== expectedStatus || body.ok === false) {
    throw failFromResponse(res, body as ApiFail);
  }
  return body as T;
}

export async function listNotes(options?: {
  cursor?: string;
  limit?: number;
}): Promise<NoteListResponse> {
  const qs = new URLSearchParams();
  if (options?.cursor) qs.set("cursor", options.cursor);
  if (options?.limit) qs.set("limit", String(options.limit));
  const suffix = qs.size ? `?${qs.toString()}` : "";
  const res = await fetch(`${NOTES_API.list}${suffix}`, { credentials: "include" });
  const body = await expectOk<{
    ok: true;
    notes: Note[];
    nextCursor: string | null;
  }>(res, API_SUCCESS_STATUS.noteRead);
  return { notes: body.notes, nextCursor: body.nextCursor };
}

export async function getNote(id: string): Promise<Note> {
  const res = await fetch(NOTES_API.item(id), { credentials: "include" });
  const body = await expectOk<{ ok: true; note: Note }>(res, API_SUCCESS_STATUS.noteRead);
  return body.note;
}

export async function createNote(input: CreateNoteInput): Promise<Note> {
  const res = await fetch(NOTES_API.list, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: input.title, body: input.body }),
  });
  const body = await expectOk<{ ok: true; note: Note }>(res, API_SUCCESS_STATUS.noteCreate);
  return body.note;
}

export async function updateNote(id: string, input: UpdateNoteInput): Promise<Note> {
  const res = await fetch(NOTES_API.item(id), {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: input.title, body: input.body }),
  });
  const body = await expectOk<{ ok: true; note: Note }>(res, API_SUCCESS_STATUS.noteRead);
  return body.note;
}

export async function trashNote(id: string): Promise<Note> {
  const res = await fetch(NOTES_API.item(id), {
    method: "DELETE",
    credentials: "include",
  });
  const body = await expectOk<{ ok: true; note: Note }>(res, API_SUCCESS_STATUS.noteRead);
  return body.note;
}

export async function restoreNote(id: string): Promise<Note> {
  const res = await fetch(NOTES_API.restore(id), {
    method: "POST",
    credentials: "include",
  });
  const body = await expectOk<{ ok: true; note: Note }>(res, API_SUCCESS_STATUS.noteRead);
  return body.note;
}

export type CaptureTarget = "inbox" | "note";

export type CapturePayload = {
  target: CaptureTarget;
  title: string;
  body: string;
  url?: string;
  file?: File | null;
};

export type CaptureFailureReason =
  | "unauthorized"
  | "validation"
  | "ingest_failed"
  | "unsupported_media"
  | "payload_too_large"
  | "not_found"
  | "misconfigured"
  | "jev_error"
  | "key_missing"
  | "network"
  | "server";

export type CaptureResult =
  | {
      ok: true;
      target: CaptureTarget;
      noteId?: string;
      inboxItemId?: string;
      /** UI flag — derived from Rex wire `duplicateHint` via `wireDuplicateHintToBoolean`. */
      duplicateHint: boolean;
      judgments: CaptureJudgments;
    }
  | { ok: false; reason: CaptureFailureReason };

async function uploadAttachmentForCapture(
  file: File,
  refs: { noteId?: string; inboxItemId?: string },
): Promise<CaptureResult | null> {
  const form = new FormData();
  form.set("file", file);
  if (refs.noteId) form.set("noteId", refs.noteId);
  if (refs.inboxItemId) form.set("inboxItemId", refs.inboxItemId);

  try {
    const res = await fetch(ATTACHMENTS_API, {
      method: "POST",
      credentials: "include",
      body: form,
    });
    const body = await parseJson<{ ok: boolean; code?: NoteApiErrorCode }>(res);
    if (res.status !== API_SUCCESS_STATUS.attachment || body.ok === false) {
      const code = mapNoteApiFailure(res.status, body.code);
      if (code === "unsupported_media") return { ok: false, reason: "unsupported_media" };
      if (code === "payload_too_large") return { ok: false, reason: "payload_too_large" };
      if (code === "not_found") return { ok: false, reason: "not_found" };
      if (code === "unauthorized") return { ok: false, reason: "unauthorized" };
      if (code === "misconfigured") return { ok: false, reason: "misconfigured" };
      if (code === "validation") return { ok: false, reason: "validation" };
      return { ok: false, reason: "server" };
    }
    return null;
  } catch {
    return { ok: false, reason: "network" };
  }
}

function captureFailFromApi(status: number, body: ApiFail): CaptureResult {
  const code = mapNoteApiFailure(status, body.code);
  switch (code) {
    case "unauthorized":
      return { ok: false, reason: "unauthorized" };
    case "validation":
      return { ok: false, reason: "validation" };
    case "ingest_failed":
      return { ok: false, reason: "ingest_failed" };
    case "judgment_failed":
      return { ok: false, reason: "jev_error" };
    case "typesafe_misconfigured":
      return { ok: false, reason: "key_missing" };
    case "misconfigured":
      return { ok: false, reason: "misconfigured" };
    default:
      return { ok: false, reason: "server" };
  }
}

export async function submitCapture(payload: CapturePayload): Promise<CaptureResult> {
  try {
    const res = await fetch(CAPTURE_API, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: payload.title,
        body: payload.body,
        target: payload.target,
        ...(payload.url?.trim() ? { url: payload.url.trim() } : {}),
      }),
    });

    const body = await parseJson<(CaptureNoteOk | CaptureInboxOk) | ApiFail>(res);

    if (res.status !== API_SUCCESS_STATUS.capture || body.ok === false) {
      return captureFailFromApi(res.status, body as ApiFail);
    }

    const judgments = parseCaptureJudgmentFields(body);
    if (!judgments) {
      return { ok: false, reason: "server" };
    }

    const noteId = body.target === "note" ? body.note.id : undefined;
    const inboxItemId = body.target === "inbox" ? body.inboxItem.id : undefined;

    if (payload.file) {
      const uploadResult = await uploadAttachmentForCapture(payload.file, {
        noteId,
        inboxItemId,
      });
      if (uploadResult) return uploadResult;
    }

    return {
      ok: true,
      target: body.target,
      noteId,
      inboxItemId,
      duplicateHint: wireDuplicateHintToBoolean(judgments.duplicateHint),
      judgments,
    };
  } catch {
    return { ok: false, reason: "network" };
  }
}

/** Days until Rex hard-purges (uses `purgeAt`; contract: deletedAt + 7d). */
export function daysUntilPurge(purgeAt: string | null, deletedAt?: string | null): number {
  if (purgeAt) {
    const remainingMs = new Date(purgeAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
  }
  if (deletedAt) {
    const trashed = new Date(deletedAt).getTime();
    const purgeEstimate = trashed + 7 * 24 * 60 * 60 * 1000;
    return Math.max(0, Math.ceil((purgeEstimate - Date.now()) / (24 * 60 * 60 * 1000)));
  }
  return 0;
}

export function isNotesApiError(err: unknown): err is NotesApiError {
  return err instanceof NotesApiError;
}
