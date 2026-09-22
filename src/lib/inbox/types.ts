/** UI view of Rex inbox rows. Do not import `src/domain` or `src/server` from this lane. */

export const INBOX_SOURCES = ["web", "url", "share", "api", "file"] as const;
export type InboxSource = (typeof INBOX_SOURCES)[number];

export type TagSuggestion = {
  tag: string;
  /** 0–1 */
  probability: number;
};

export type InboxClassificationView = {
  choice: string;
  probability: number;
  confidence: number;
};

/** Stored Jev output from POST suggest / list. Not an applied tag set. */
export type InboxSuggestions = {
  tags: TagSuggestion[];
  classification: InboxClassificationView | null;
  judgedAt: string;
};

/** Surface codes. Wire codes `judgment_failed` / `typesafe_misconfigured` map to these. */
export type JevFailure = "jev_error" | "key_missing";

export type InboxItem = {
  id: string;
  title: string;
  body: string;
  source: InboxSource;
  url: string | null;
  createdAt: string;
  promotedNoteId: string | null;
  discardedAt: string | null;
  suggestions: InboxSuggestions | null;
};

/** Failed URL summary from GET /api/inbox?view=ingest. Not an inbox row. */
export type IngestJobView = {
  id: string;
  title: string;
  detail: string;
  createdAt: string;
};

export type PromotionDraft =
  | {
      ok: true;
      title: string;
      summary: string;
      tags: TagSuggestion[];
      confidence: number | null;
    }
  | {
      ok: false;
      reason: JevFailure | "unavailable";
      title: string;
      summary: string;
    };

export type ProposalMode = "suggest" | "manual";

export type Proposal = {
  itemId: string;
  mode: ProposalMode;
  title: string;
  summary: string;
  tags: TagSuggestion[];
  selectedTags: string[];
  confidence: number | null;
  jevError: JevFailure | null;
};

export type InboxFailureReason =
  | "network"
  | "unauthorized"
  | "not_found"
  | "promote_failed"
  | "discard_failed"
  | "ingest_failed"
  | "already_promoted"
  | "discarded"
  | "not_failed"
  | "not_retriable"
  | "validation"
  | "jev_error"
  | "key_missing"
  | "server";
