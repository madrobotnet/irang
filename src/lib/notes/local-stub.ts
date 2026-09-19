import type { CreateNoteInput, Note, NoteListResponse, UpdateNoteInput } from "./types";

const STORAGE_KEY = "sb-notes-stub-v1";

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  return `note_${crypto.randomUUID()}`;
}

function readAll(): Note[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Note[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(notes: Note[]): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

export const localNotesStub = {
  async list(): Promise<NoteListResponse> {
    const items = readAll()
      .filter((n) => !n.trashedAt)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return { items, nextCursor: null };
  },

  async get(id: string): Promise<Note | null> {
    return readAll().find((n) => n.id === id) ?? null;
  },

  async create(input: CreateNoteInput): Promise<Note> {
    const note: Note = {
      id: newId(),
      title: input.title,
      body: input.body,
      kind: "wiki",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      trashedAt: null,
    };
    const all = readAll();
    all.push(note);
    writeAll(all);
    return note;
  },

  async update(id: string, input: UpdateNoteInput): Promise<Note> {
    const all = readAll();
    const idx = all.findIndex((n) => n.id === id);
    if (idx < 0) throw new Error("not_found");
    const updated: Note = {
      ...all[idx],
      title: input.title,
      body: input.body,
      updatedAt: nowIso(),
    };
    all[idx] = updated;
    writeAll(all);
    return updated;
  },

  async trash(id: string): Promise<Note> {
    const all = readAll();
    const idx = all.findIndex((n) => n.id === id);
    if (idx < 0) throw new Error("not_found");
    const updated: Note = {
      ...all[idx],
      trashedAt: nowIso(),
      updatedAt: nowIso(),
    };
    all[idx] = updated;
    writeAll(all);
    return updated;
  },

  async restore(id: string): Promise<Note> {
    const all = readAll();
    const idx = all.findIndex((n) => n.id === id);
    if (idx < 0) throw new Error("not_found");
    const updated: Note = {
      ...all[idx],
      trashedAt: null,
      updatedAt: nowIso(),
    };
    all[idx] = updated;
    writeAll(all);
    return updated;
  },
};
