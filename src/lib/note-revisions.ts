/** The kind of change that replaced a snapshot. Keep in sync with the note_revisions CHECK constraint. */
export type RevisionReason = "edit" | "restore" | "merge" | "link-mention" | "task-toggle";

export type NoteRevisionSummary = {
  id: string;
  createdAt: string; // ISO
  reason: RevisionReason;
  title: string;
  /** Body length in characters (code points). */
  bodyLength: number;
  /** Plain-text preview of the body, <= 160 chars. */
  excerpt: string;
};

export type NoteRevision = {
  id: string;
  noteId: string;
  createdAt: string; // ISO
  reason: RevisionReason;
  title: string;
  body: string;
  tags: string[];
  aliases: string[];
};
