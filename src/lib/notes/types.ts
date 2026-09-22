/** UI view of Rex `NoteRecord` (see server/domain — do not import from domain in UI lane). */

export type NoteStatus = "draft" | "confirmed" | "archived";

export type Note = {
  id: string;
  title: string;
  body: string;
  status: NoteStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  purgeAt: string | null;
};

export type NoteListResponse = {
  notes: Note[];
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

export type InboxItemSummary = {
  id: string;
  title: string;
};
