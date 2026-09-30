import { api } from "@/lib/api-client";
import { renderTemplate } from "@/lib/templates";
import type { NoteRef } from "@/lib/types";

/** SWR key of the template list, shared by Settings and the command palette. */
export const TEMPLATES_KEY = "/api/templates";

/** Whether the body has a `{{title}}` placeholder, judged by the shared renderer so the syntax lives in one place. */
export function usesTitle(body: string): boolean {
  return renderTemplate(body, { date: "", title: "" }) !== renderTemplate(body, { date: "", title: "\u0000" });
}

export type TemplateNoteResult = { note: NoteRef; bodyError: unknown };

/**
 * Creates a note with the server's default title (as "New note" does) and the rendered body.
 * The default title ("Untitled 2") is only known once the note exists, so a body that uses
 * `{{title}}` is written by a follow-up PATCH; if that fails the empty note is kept and returned
 * with `bodyError`, so the caller can open it and say what went wrong.
 */
export async function createNoteFromTemplate(body: string, date: string): Promise<TemplateNoteResult> {
  if (!usesTitle(body)) {
    const { note } = await api<{ note: NoteRef }>("/api/notes", { method: "POST", json: { body: renderTemplate(body, { date, title: "" }) } });
    return { note, bodyError: null };
  }
  const { note } = await api<{ note: NoteRef }>("/api/notes", { method: "POST", json: {} });
  try {
    await api(`/api/notes/${encodeURIComponent(note.id)}`, { method: "PATCH", json: { body: renderTemplate(body, { date, title: note.title }) } });
    return { note, bodyError: null };
  } catch (bodyError) {
    return { note, bodyError };
  }
}
