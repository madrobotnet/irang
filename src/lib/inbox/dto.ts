/**
 * E3 shared envelopes for Rex inbox JSON.
 * Item fields stay on `InboxItemDto`. No domain or server CRUD.
 *
 * Missing Jev output is `suggestions: null` or an error code
 * (`typesafe_misconfigured`, `judgment_failed`). Callers must not fill a class.
 */

import type { NoteApiErrorCode } from "@/lib/api/note-contract";
import type {
  DuplicateHintDto,
  InboxClassificationDto,
  InboxItemDto,
  InboxItemOk,
  NoteDto,
} from "@/lib/api/note-dto";

export type {
  InboxClassificationDto,
  InboxClassIdDto,
  InboxItemDto,
  InboxItemOk,
  InboxListOk,
  InboxSuggestionsDto,
  InboxTagSuggestionDto,
  PromoteInboxOk,
} from "@/lib/api/note-dto";

/** `POST /api/inbox/:id/discard` success: `{ ok: true, inboxItem }`. */
export type DiscardInboxOk = InboxItemOk;

export type InboxCommandAction = "suggest" | "retry";

/** `POST /api/inbox` body. Same pathname as list/read. */
export type InboxCommandBody = {
  action: InboxCommandAction;
  id: string;
};

/** `POST /api/inbox` `{ action: "suggest" }` success. */
export type RefreshInboxSuggestionsOk = InboxItemOk;

/** E3 codes beyond the note envelope. Same `{ ok: false, code }` shape. */
export type InboxOnlyErrorCode =
  | "already_promoted"
  | "discarded"
  | "not_failed"
  | "not_retriable";

export type InboxApiErrorCode = NoteApiErrorCode | InboxOnlyErrorCode;

export type InboxErrorBody = {
  ok: false;
  code: InboxApiErrorCode;
  fields?: string[];
  jobId?: string;
};

export type IngestJobDto = {
  id: string;
  kind: string;
  status: string;
  payload: Record<string, unknown>;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

/** `GET /api/inbox?view=ingest` success. */
export type IngestJobListOk = {
  ok: true;
  jobs: IngestJobDto[];
  nextCursor: string | null;
};

/** `GET /api/inbox?view=ingest&id=` success. */
export type IngestJobOk = {
  ok: true;
  job: IngestJobDto;
};

/**
 * Top-level judgment fields on capture and ingest retry.
 * Classification is present only when Rex asked the Choice question.
 * Tag entries are Nouls (probability only).
 */
export type InboxJudgmentFieldsDto = {
  suggestions: {
    tags: { tag: string; probability: number }[];
    classification?: InboxClassificationDto;
  };
  duplicateHint: DuplicateHintDto | null;
};

export type RetryIngestNoteOk = InboxJudgmentFieldsDto & {
  ok: true;
  job: IngestJobDto;
  target: "note";
  note: NoteDto;
};

export type RetryIngestInboxOk = InboxJudgmentFieldsDto & {
  ok: true;
  job: IngestJobDto;
  target: "inbox";
  inboxItem: InboxItemDto;
};

/** `POST /api/inbox` `{ action: "retry" }` success. */
export type RetryIngestOk = RetryIngestNoteOk | RetryIngestInboxOk;
