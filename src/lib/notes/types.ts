export type NoteKind = "wiki" | "raw";

/** Rex/Kai contract — see `api-contract.ts` for HTTP shapes. */
export type Note = {
  id: string;
  title: string;
  body: string;
  kind: NoteKind;
  createdAt: string;
  updatedAt: string;
  /** ISO timestamp when soft-deleted; null = active */
  trashedAt: string | null;
};

export type NoteListResponse = {
  items: Note[];
  nextCursor: string | null;
};

export type CreateNoteInput = {
  title: string;
  body: string;
};

export type UpdateNoteInput = {
  title: string;
  body: string;
};

export const TRASH_RETENTION_DAYS = 7;
