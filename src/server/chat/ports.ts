import type {
  AiLogRecord,
  ChatMessageRecord,
  ChatMessageRole,
  ChatProposalRecord,
  ChatThreadRecord,
  ProposalPatch,
  ProposalStatus,
  StoredCitation,
} from "@/domain/chat/types";
import type { ChatRouteJudgmentDto } from "@/lib/chat/dto";

export type ListThreadsQuery = {
  limit: number;
  cursor?: string;
  includeArchived: boolean;
};

export type ListMessagesQuery = {
  limit: number;
  cursor?: string;
};

export type ListProposalsQuery = {
  status?: ProposalStatus;
  limit: number;
};

export type CreateMessageInput = {
  threadId: string;
  role: ChatMessageRole;
  content: string;
  citations: StoredCitation[];
  routing: ChatRouteJudgmentDto | null;
};

export type CreateProposalInput = {
  messageId: string;
  threadId: string;
  noteId: string;
  patch: ProposalPatch;
};

export type ChatStore = {
  createThread(input: { title: string | null }): Promise<ChatThreadRecord>;
  listThreads(query: ListThreadsQuery): Promise<{ threads: ChatThreadRecord[]; nextCursor: string | null }>;
  getThread(id: string): Promise<ChatThreadRecord | null>;
  archiveThread(id: string, at: Date): Promise<ChatThreadRecord | null>;
  touchThread(id: string, at: Date): Promise<void>;

  createMessage(input: CreateMessageInput): Promise<ChatMessageRecord>;
  listMessages(
    threadId: string,
    query: ListMessagesQuery,
  ): Promise<{ messages: ChatMessageRecord[]; nextCursor: string | null }>;
  listRecentMessages(threadId: string, limit: number): Promise<ChatMessageRecord[]>;
  getMessage(id: string): Promise<ChatMessageRecord | null>;

  createProposal(input: CreateProposalInput): Promise<ChatProposalRecord>;
  listProposals(query: ListProposalsQuery): Promise<ChatProposalRecord[]>;
  getProposal(id: string): Promise<ChatProposalRecord | null>;
  /** Conditional update. Null when the row is missing or not pending. */
  resolveProposal(
    id: string,
    status: Exclude<ProposalStatus, "pending">,
    at: Date,
  ): Promise<ChatProposalRecord | null>;
  reopenProposal(id: string): Promise<ChatProposalRecord | null>;

  writeAiLog(input: {
    kind: string;
    threadId: string | null;
    payload: Record<string, unknown>;
  }): Promise<AiLogRecord>;
  listAiLogs(): Promise<AiLogRecord[]>;
  purgeAiLogs(before: Date): Promise<number>;
};
