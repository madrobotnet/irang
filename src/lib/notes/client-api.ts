import type { NoteApiErrorCode } from "@/lib/api/note-contract";
import {
  ATTACHMENTS_API,
  CAPTURE_API,
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
    message: string,
    readonly status: number,
    readonly code?: NoteApiErrorCode,
  ) {
    super(message);
    this.name = "NotesApiError";
  }
}

type ApiFail = { ok: false; code: NoteApiErrorCode; fields?: string[] };

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

async function expectOk<T extends { ok: true }>(res: Response): Promise<T> {
  const body = await parseJson<T | ApiFail>(res);
  if (!res.ok || (body as ApiFail).ok === false) {
    const fail = body as ApiFail;
    throw new NotesApiError(fail.code ?? "request_failed", res.status, fail.code);
  }
  return body as T;
}

export async function listNotes(cursor?: string): Promise<NoteListResponse> {
  const qs = new URLSearchParams();
  if (cursor) qs.set("cursor", cursor);
  const suffix = qs.size ? `?${qs.toString()}` : "";
  const res = await fetch(`${NOTES_API.list}${suffix}`, { credentials: "include" });
  const body = await expectOk<{ ok: true; notes: Note[]; nextCursor: string | null }>(res);
  return { notes: body.notes, nextCursor: body.nextCursor };
}

export async function getNote(id: string): Promise<Note> {
  const res = await fetch(NOTES_API.item(id), { credentials: "include" });
  const body = await expectOk<{ ok: true; note: Note }>(res);
  return body.note;
}

export async function createNote(input: CreateNoteInput): Promise<Note> {
  const res = await fetch(NOTES_API.list, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: input.title, body: input.body }),
  });
  const body = await expectOk<{ ok: true; note: Note }>(res);
  return body.note;
}

export async function updateNote(id: string, input: UpdateNoteInput): Promise<Note> {
  const res = await fetch(NOTES_API.item(id), {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: input.title, body: input.body }),
  });
  const body = await expectOk<{ ok: true; note: Note }>(res);
  return body.note;
}

export async function trashNote(id: string): Promise<Note> {
  const res = await fetch(NOTES_API.item(id), {
    method: "DELETE",
    credentials: "include",
  });
  const body = await expectOk<{ ok: true; note: Note }>(res);
  return body.note;
}

export async function restoreNote(id: string): Promise<Note> {
  const res = await fetch(NOTES_API.restore(id), {
    method: "POST",
    credentials: "include",
  });
  const body = await expectOk<{ ok: true; note: Note }>(res);
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

export type CaptureResult =
  | {
      ok: true;
      target: CaptureTarget;
      noteId?: string;
      inboxItemId?: string;
    }
  | {
      ok: false;
      reason: "network" | "duplicate" | "server" | "mime" | "size" | "ingest_failed";
    };

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
    if (!res.ok || body.ok === false) {
      if (body.code === "unsupported_media") return { ok: false, reason: "mime" };
      if (body.code === "payload_too_large") return { ok: false, reason: "size" };
      return { ok: false, reason: "server" };
    }
    return null;
  } catch {
    return { ok: false, reason: "network" };
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

    const body = await parseJson<
      | { ok: true; target: "note"; note: { id: string } }
      | { ok: true; target: "inbox"; inboxItem: { id: string } }
      | ApiFail
    >(res);

    if (!res.ok || body.ok === false) {
      const fail = body as ApiFail;
      if (res.status === 409) return { ok: false, reason: "duplicate" };
      if (fail.code === "ingest_failed") return { ok: false, reason: "ingest_failed" };
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
    };
  } catch {
    return { ok: false, reason: "network" };
  }
}

/** Days until Rex hard-purges a soft-deleted note (uses purgeAt when present). */
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
