import type { Note } from "@/lib/types";
import { NoteDraftController, type EditableNote } from "./note-draft";

// Client-session drafts outlive route components so a failed save is recoverable.
const drafts = new Map<string, NoteDraftController>();

export function getNoteDraft(note: Note, save: (id: string, value: EditableNote) => Promise<Note>): NoteDraftController {
  const existing = drafts.get(note.id);
  if (existing) return existing;
  const controller = new NoteDraftController(note, save);
  drafts.set(note.id, controller);
  return controller;
}

export function forgetNoteDraft(id: string): void {
  drafts.delete(id);
}

export function hasUnsavedNoteDrafts(): boolean {
  return [...drafts.values()].some((draft) => draft.getSnapshot().state !== "saved");
}
