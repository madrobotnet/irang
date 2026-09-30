import { parseTasks, toggleTask, type TaskToggle } from "@/lib/tasks";
import type { Note } from "@/lib/types";

export type EditableNote = Pick<Note, "title" | "body" | "tags" | "aliases">;
export type SaveState = "saved" | "dirty" | "saving" | "failed";
export type DraftSnapshot = EditableNote & {
  noteId: string;
  version: number;
  state: SaveState;
  /** The last save failure as thrown, kept whole so the UI renders it in the current language. */
  error: unknown;
  updatedAt: string;
};

type Save = (noteId: string, value: EditableNote) => Promise<Note>;
type Listener = () => void;

export type TaskToggleMerge = { kind: "replace" } | { kind: "update"; body: string } | { kind: "keep" };

/**
 * How a task toggle saved by the server joins the local draft. A clean draft still in preview adopts
 * the returned note (`replace`). Otherwise the same one-character change is applied to the local body
 * (`update`), so the next autosave carries both the typing and the toggle; if edits moved the task,
 * the one task with the same text receives it. `keep` means the draft already has that state or no
 * longer holds that task, and the draft wins.
 */
export function mergeTaskToggle(draft: Pick<DraftSnapshot, "state" | "body">, toggle: TaskToggle, inPreview: boolean): TaskToggleMerge {
  if (inPreview && draft.state === "saved") return { kind: "replace" };
  let result = toggleTask(draft.body, toggle);
  if (!result.ok) {
    const moved = parseTasks(draft.body).filter((task) => task.text === toggle.expectedText);
    if (moved.length === 1) result = toggleTask(draft.body, { ...toggle, line: moved[0]!.line });
  }
  return result.ok && result.changed ? { kind: "update", body: result.body } : { kind: "keep" };
}

export class NoteDraftController {
  private snapshot: DraftSnapshot;
  private readonly listeners = new Set<Listener>();
  private inFlight: Promise<boolean> | null = null;

  constructor(note: Note, private readonly save: Save) {
    this.snapshot = fromNote(note);
  }

  getSnapshot = (): DraftSnapshot => this.snapshot;
  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** A revalidation may refresh a clean draft, but can never replace local edits. */
  hydrate(note: Note): void {
    if (note.id !== this.snapshot.noteId || this.snapshot.state !== "saved") return;
    if (Date.parse(note.updatedAt) <= Date.parse(this.snapshot.updatedAt)) return;
    this.snapshot = fromNote(note);
    this.emit();
  }

  /**
   * Adopt a server-side replacement (a version restore) over any local state, so no queued
   * autosave sends the old text. A save still in flight re-sends the replacement once it settles.
   */
  replace(note: Note): void {
    if (note.id !== this.snapshot.noteId) return;
    this.snapshot = { ...fromNote(note), version: this.snapshot.version + 1 };
    this.emit();
  }

  update(patch: Partial<EditableNote>): void {
    this.snapshot = {
      ...this.snapshot,
      ...patch,
      version: this.snapshot.version + 1,
      state: "dirty",
      error: null,
    };
    this.emit();
  }

  flush = (): Promise<boolean> => {
    if (this.inFlight) return this.inFlight;
    if (this.snapshot.state === "saved") return Promise.resolve(true);
    this.inFlight = this.run().finally(() => { this.inFlight = null; });
    return this.inFlight;
  };

  retry = (): Promise<boolean> => {
    if (this.snapshot.state === "failed") {
      this.snapshot = { ...this.snapshot, state: "dirty", error: null };
      this.emit();
    }
    return this.flush();
  };

  private async run(): Promise<boolean> {
    while (this.snapshot.state !== "saved") {
      const version = this.snapshot.version;
      const value: EditableNote = {
        title: this.snapshot.title,
        body: this.snapshot.body,
        tags: this.snapshot.tags,
        aliases: this.snapshot.aliases,
      };
      this.snapshot = { ...this.snapshot, state: "saving", error: null };
      this.emit();
      try {
        const saved = await this.save(this.snapshot.noteId, value);
        if (this.snapshot.version === version) {
          this.snapshot = {
            ...this.snapshot, title: saved.title, body: saved.body,
            tags: saved.tags, aliases: saved.aliases,
            state: "saved", error: null, updatedAt: saved.updatedAt,
          };
          this.emit();
          return true;
        }
        this.snapshot = {
          ...this.snapshot,
          title: this.snapshot.title === value.title ? saved.title : this.snapshot.title,
          body: this.snapshot.body === value.body ? saved.body : this.snapshot.body,
          tags: JSON.stringify(this.snapshot.tags) === JSON.stringify(value.tags) ? saved.tags : this.snapshot.tags,
          aliases: JSON.stringify(this.snapshot.aliases) === JSON.stringify(value.aliases) ? saved.aliases : this.snapshot.aliases,
          state: "dirty",
        };
        this.emit();
      } catch (error) {
        this.snapshot = {
          ...this.snapshot,
          state: "failed",
          error,
        };
        this.emit();
        return false;
      }
    }
    return true;
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

function fromNote(note: Note): DraftSnapshot {
  return {
    noteId: note.id,
    title: note.title,
    body: note.body,
    tags: note.tags,
    aliases: note.aliases,
    version: 0,
    state: "saved",
    error: null,
    updatedAt: note.updatedAt,
  };
}
