import { parseStoredInboxSuggestions } from "@/domain/inbox/suggestions";
import type {
  AttachmentRecord,
  InboxItemRecord,
  IngestJobRecord,
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
  suggestions?: unknown;
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
    suggestions: parseStoredInboxSuggestions(row.suggestions ?? null),
  };
}

export function mapIngestJobRow(row: {
  id: string;
  kind: string;
  status: string;
  payload: unknown;
  error: string | null;
  created_at: Date;
  updated_at: Date;
}): IngestJobRecord {
  let payload: Record<string, unknown> = {};
  if (row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)) {
    payload = row.payload as Record<string, unknown>;
  } else if (typeof row.payload === "string") {
    try {
      const parsed = JSON.parse(row.payload) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        payload = parsed as Record<string, unknown>;
      }
    } catch {
      payload = {};
    }
  }
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    payload,
    error: row.error,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
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
