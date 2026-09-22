import type { ChatRouteJudgmentDto } from "@/lib/chat/dto";

export type ChatMessageRole = "user" | "assistant" | "system";

export type StoredCitation = {
  noteId: string;
  title: string;
  snippet?: string;
};

export type ChatThreadRecord = {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type ChatMessageRecord = {
  id: string;
  threadId: string;
  role: ChatMessageRole;
  content: string;
  citations: StoredCitation[];
  routing: ChatRouteJudgmentDto | null;
  createdAt: string;
};

export type ProposalStatus = "pending" | "approved" | "rejected";

export type ProposalPatch = {
  title?: string;
  body?: string;
};

export type ChatProposalRecord = {
  id: string;
  messageId: string;
  threadId: string;
  noteId: string;
  patch: ProposalPatch;
  status: ProposalStatus;
  createdAt: string;
  resolvedAt: string | null;
};

export type AiLogRecord = {
  id: string;
  kind: string;
  threadId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
};
