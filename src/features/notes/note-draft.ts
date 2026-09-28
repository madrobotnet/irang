import type { Note } from "@/lib/types";

export type EditableNote = Pick<Note, "title" | "body" | "tags" | "aliases">;
export type SaveState = "saved" | "dirty" | "saving" | "failed";
export type DraftSnapshot = EditableNote & {
  noteId: string;
  version: number;
  state: SaveState;
  error: string | null;
  updatedAt: string;
};

type Save = (noteId: string, value: EditableNote) => Promise<Note>;
type Listener = () => void;

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
          error: error instanceof Error ? error.message : "저장하지 못했습니다.",
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
