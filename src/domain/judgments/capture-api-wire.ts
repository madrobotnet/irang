import type { InboxItemRecord, NoteRecord } from "@/domain/notes/types";
import type { CaptureJudgments } from "./types";

/** Judgment fields on successful capture/share responses (Kai client boundary). */
export type CaptureJudgmentFields = CaptureJudgments;

export type CaptureNoteCreatedResponse = {
  ok: true;
  target: "note";
  note: NoteRecord;
  suggestions: CaptureJudgments["suggestions"];
  duplicateHint: CaptureJudgments["duplicateHint"];
};

export type CaptureInboxCreatedResponse = {
  ok: true;
  target: "inbox";
  inboxItem: InboxItemRecord;
  suggestions: CaptureJudgments["suggestions"];
  duplicateHint: CaptureJudgments["duplicateHint"];
};

export type CaptureShareCreatedResponse = {
  ok: true;
  inboxItem: InboxItemRecord;
  suggestions: CaptureJudgments["suggestions"];
  duplicateHint: CaptureJudgments["duplicateHint"];
};
