import { CAPTURE_API, NOTES_API } from "./api-contract";
import { localNotesStub } from "./local-stub";
import type {
  CreateNoteInput,
  Note,
  NoteListResponse,
  UpdateNoteInput,
} from "./types";

export class NotesApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "NotesApiError";
  }
}

let preferStub = false;

function apiUnavailable(status: number): boolean {
  return status === 404 || status === 501 || status === 405;
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

async function withStubFallback<T>(
  http: () => Promise<T>,
  stub: () => Promise<T>,
): Promise<T> {
  if (preferStub) return stub();
  try {
    return await http();
  } catch (err) {
    if (err instanceof NotesApiError && err.status && apiUnavailable(err.status)) {
      preferStub = true;
      return stub();
    }
    throw err;
  }
}

export async function listNotes(cursor?: string): Promise<NoteListResponse> {
  return withStubFallback(
    async () => {
      const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
      const res = await fetch(`${NOTES_API.list}${qs}`, { credentials: "include" });
      if (!res.ok) {
        throw new NotesApiError("list_failed", res.status);
      }
      return parseJson<NoteListResponse>(res);
    },
    () => localNotesStub.list(),
  );
}

export async function getNote(id: string): Promise<Note> {
  return withStubFallback(
    async () => {
      const res = await fetch(NOTES_API.item(id), { credentials: "include" });
      if (!res.ok) {
        throw new NotesApiError("get_failed", res.status);
      }
      return parseJson<Note>(res);
    },
    async () => {
      const note = await localNotesStub.get(id);
      if (!note) throw new NotesApiError("not_found", 404);
      return note;
    },
  );
}

export async function createNote(input: CreateNoteInput): Promise<Note> {
  return withStubFallback(
    async () => {
      const res = await fetch(NOTES_API.list, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        throw new NotesApiError("create_failed", res.status);
      }
      return parseJson<Note>(res);
    },
    () => localNotesStub.create(input),
  );
}

export async function updateNote(id: string, input: UpdateNoteInput): Promise<Note> {
  return withStubFallback(
    async () => {
      const res = await fetch(NOTES_API.item(id), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        throw new NotesApiError("update_failed", res.status);
      }
      return parseJson<Note>(res);
    },
    () => localNotesStub.update(id, input),
  );
}

export async function trashNote(id: string): Promise<Note> {
  return withStubFallback(
    async () => {
      const res = await fetch(NOTES_API.item(id), {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        throw new NotesApiError("trash_failed", res.status);
      }
      return parseJson<Note>(res);
    },
    () => localNotesStub.trash(id),
  );
}

export async function restoreNote(id: string): Promise<Note> {
  return withStubFallback(
    async () => {
      const res = await fetch(NOTES_API.restore(id), {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        throw new NotesApiError("restore_failed", res.status);
      }
      return parseJson<Note>(res);
    },
    () => localNotesStub.restore(id),
  );
}

export type CaptureMode = "inbox" | "note";

export type CapturePayload = {
  mode: CaptureMode;
  title: string;
  body: string;
  url?: string;
  file?: File | null;
};

export type CaptureResult =
  | { ok: true; target: CaptureMode; id?: string }
  | { ok: false; reason: "network" | "duplicate" | "server" };

export async function submitCapture(payload: CapturePayload): Promise<CaptureResult> {
  try {
    const form = new FormData();
    form.set("mode", payload.mode);
    form.set("title", payload.title);
    form.set("body", payload.body);
    if (payload.url?.trim()) form.set("url", payload.url.trim());
    if (payload.file) form.set("file", payload.file);

    const res = await fetch(CAPTURE_API, {
      method: "POST",
      credentials: "include",
      body: form,
    });

    if (res.status === 409) {
      return { ok: false, reason: "duplicate" };
    }
    if (!res.ok) {
      if (apiUnavailable(res.status)) {
        if (payload.mode === "note") {
          const note = await createNote({
            title: payload.title,
            body: payload.body,
          });
          return { ok: true, target: "note", id: note.id };
        }
        return { ok: true, target: "inbox" };
      }
      return { ok: false, reason: "server" };
    }
    const data = await parseJson<{ id?: string; target?: CaptureMode }>(res);
    return {
      ok: true,
      target: data.target ?? payload.mode,
      id: data.id,
    };
  } catch {
    return { ok: false, reason: "network" };
  }
}

export function daysUntilTrashPurge(trashedAt: string, retentionDays = 7): number {
  const trashed = new Date(trashedAt).getTime();
  const purgeAt = trashed + retentionDays * 24 * 60 * 60 * 1000;
  const remainingMs = purgeAt - Date.now();
  return Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
}

/** @internal test helper */
export function resetNotesApiPreference(): void {
  preferStub = false;
}
