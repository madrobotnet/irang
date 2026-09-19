import type {
  AttachmentRecord,
  InboxItemRecord,
  NoteRecord,
} from "@/domain/notes/types";
import type { NoteStatus } from "@/domain/notes/constants";
import type { InboxSource } from "@/domain/notes/constants";

export function mapNoteRow(row: {
  id: string;
  title: string;
  body: string;
  status: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  purge_at: Date | null;
}): NoteRecord {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    status: row.status as NoteStatus,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    deletedAt: row.deleted_at ? row.deleted_at.toISOString() : null,
    purgeAt: row.purge_at ? row.purge_at.toISOString() : null,
  };
}

export function mapInboxRow(row: {
  id: string;
  title: string;
  body: string;
  source: string;
  url: string | null;
  promoted_note_id: string | null;
  discarded_at: Date | null;
  created_at: Date;
}): InboxItemRecord {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    source: row.source as InboxSource,
    url: row.url,
    promotedNoteId: row.promoted_note_id,
    discardedAt: row.discarded_at ? row.discarded_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
  };
}

export function mapAttachmentRow(row: {
  id: string;
  note_id: string | null;
  inbox_item_id: string | null;
  filename: string;
  mime: string;
  size_bytes: string | number;
  created_at: Date;
}): AttachmentRecord {
  return {
    id: row.id,
    noteId: row.note_id,
    inboxItemId: row.inbox_item_id,
    filename: row.filename,
    mime: row.mime,
    sizeBytes: Number(row.size_bytes),
    createdAt: row.created_at.toISOString(),
  };
}
