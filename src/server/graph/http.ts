import { projectGraph } from "@/domain/graph/project";
import type { NoteRecord } from "@/domain/notes/types";
import { MAX_LIST_LIMIT } from "@/domain/notes/constants";
import { errorBody, unauthorizedBody } from "@/lib/auth/api-contract";
import { readSessionCookie } from "@/lib/auth/cookie";
import { AuthStorageInitError } from "@/server/auth/init-errors";
import { getAuthRuntime } from "@/server/auth/runtime";
import { jsonResponse } from "@/server/http/json-response";
import type { NotesStore } from "@/server/notes/ports";
import { getNotesStore } from "@/server/notes/runtime";
import { isUuid, parseCreateLinkBody, parseGraphQuery } from "./parse";
import { getLinkStore } from "./runtime";

function validation(fields: string[]): Response {
  return jsonResponse({ ok: false, code: "validation", fields }, 400);
}

function notFound(): Response {
  return jsonResponse({ ok: false, code: "not_found" }, 404);
}

function deleted(): Response {
  return jsonResponse({ ok: false, code: "deleted" }, 409);
}

async function requireSession(request: Request): Promise<Response | null> {
  const token = readSessionCookie(request.headers.get("cookie"));
  if (!token) {
    return jsonResponse(unauthorizedBody(), 401);
  }
  try {
    const { service } = await getAuthRuntime();
    const session = await service.lookup(token);
    if (!session) {
      return jsonResponse(unauthorizedBody(), 401);
    }
    return null;
  } catch (error) {
    if (error instanceof AuthStorageInitError) {
      return jsonResponse(errorBody("storage_unavailable"), 503);
    }
    return jsonResponse(unauthorizedBody(), 401);
  }
}

async function listLiveNotes(store: NotesStore): Promise<NoteRecord[]> {
  const notes: NoteRecord[] = [];
  let cursor: string | undefined;
  const seen = new Set<string>();
  for (;;) {
    const page = await store.listNotes({
      limit: MAX_LIST_LIMIT,
      cursor,
      includeDeleted: false,
    });
    notes.push(...page.notes);
    if (!page.nextCursor) {
      return notes;
    }
    if (page.notes.length === 0 || seen.has(page.nextCursor)) {
      throw new Error("notes page did not advance");
    }
    seen.add(page.nextCursor);
    cursor = page.nextCursor;
  }
}

function isForeignKeyViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }
  return error.code === "23503";
}

async function requireLiveNote(
  store: NotesStore,
  id: string,
): Promise<{ ok: true } | { ok: false; response: Response }> {
  const note = await store.getNoteById(id);
  if (!note) {
    return { ok: false, response: notFound() };
  }
  if (note.deletedAt) {
    return { ok: false, response: deleted() };
  }
  return { ok: true };
}

export async function handleGetGraph(request: Request): Promise<Response> {
  const denied = await requireSession(request);
  if (denied) {
    return denied;
  }
  const parsed = parseGraphQuery(new URL(request.url).searchParams);
  if (!parsed.ok) {
    return validation(parsed.fields);
  }
  const notes = await listLiveNotes(await getNotesStore());
  const links = await (await getLinkStore()).listLinks();
  return jsonResponse(projectGraph({ notes, links, query: parsed.value }), 200);
}

export async function handleCreateLink(request: Request): Promise<Response> {
  const denied = await requireSession(request);
  if (denied) {
    return denied;
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validation(["fromNoteId", "toNoteId"]);
  }
  const parsed = parseCreateLinkBody(body);
  if (!parsed.ok) {
    return validation(parsed.fields);
  }
  const notes = await getNotesStore();
  const from = await requireLiveNote(notes, parsed.value.fromNoteId);
  if (!from.ok) {
    return from.response;
  }
  const to = await requireLiveNote(notes, parsed.value.toNoteId);
  if (!to.ok) {
    return to.response;
  }
  try {
    const result = await (await getLinkStore()).createLink(parsed.value);
    return jsonResponse({ ok: true, link: result.link }, result.created ? 201 : 200);
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      return notFound();
    }
    throw error;
  }
}

export async function handleDeleteLink(id: string, request: Request): Promise<Response> {
  const denied = await requireSession(request);
  if (denied) {
    return denied;
  }
  if (!isUuid(id)) {
    return notFound();
  }
  const removed = await (await getLinkStore()).deleteLink(id);
  if (!removed) {
    return notFound();
  }
  return jsonResponse({ ok: true }, 200);
}
