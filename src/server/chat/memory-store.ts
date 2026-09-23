import { randomUUID } from "node:crypto";
import { CitationsRequiredError } from "@/domain/chat/errors";
import type {
  AiLogRecord,
  ChatMessageRecord,
  ChatProposalRecord,
  ChatThreadRecord,
} from "@/domain/chat/types";
import type {
  ChatStore,
  CreateMessageInput,
  CreateProposalInput,
  ListMessagesQuery,
  ListProposalsQuery,
  ListThreadsQuery,
} from "./ports";

function nowIso(): string {
  return new Date().toISOString();
}

function pageById<T extends { id: string }>(
  rows: T[],
  limit: number,
  cursor: string | undefined,
): { rows: T[]; nextCursor: string | null } {
  let start = 0;
  if (cursor) {
    const index = rows.findIndex((row) => row.id === cursor);
    start = index >= 0 ? index + 1 : 0;
  }
  const slice = rows.slice(start, start + limit);
  const nextCursor = start + limit < rows.length ? (slice[slice.length - 1]?.id ?? null) : null;
  return { rows: slice, nextCursor };
}

export class MemoryChatStore implements ChatStore {
  threads = new Map<string, ChatThreadRecord>();
  messages = new Map<string, ChatMessageRecord>();
  proposals = new Map<string, ChatProposalRecord>();
  logs = new Map<string, AiLogRecord>();

  async createThread(input: { title: string | null }): Promise<ChatThreadRecord> {
    const timestamp = nowIso();
    const thread: ChatThreadRecord = {
      id: randomUUID(),
      title: input.title,
      createdAt: timestamp,
      updatedAt: timestamp,
      archivedAt: null,
    };
    this.threads.set(thread.id, thread);
    return thread;
  }

  async listThreads(query: ListThreadsQuery): Promise<{ threads: ChatThreadRecord[]; nextCursor: string | null }> {
    let rows = [...this.threads.values()];
    if (!query.includeArchived) {
      rows = rows.filter((thread) => thread.archivedAt === null);
    }
    rows.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || right.id.localeCompare(left.id));
    const page = pageById(rows, query.limit, query.cursor);
    return { threads: page.rows, nextCursor: page.nextCursor };
  }

  async getThread(id: string): Promise<ChatThreadRecord | null> {
    return this.threads.get(id) ?? null;
  }

  async archiveThread(id: string, at: Date): Promise<ChatThreadRecord | null> {
    const thread = this.threads.get(id);
    if (!thread) {
      return null;
    }
    const next: ChatThreadRecord = {
      ...thread,
      archivedAt: thread.archivedAt ?? at.toISOString(),
      updatedAt: at.toISOString(),
    };
    this.threads.set(id, next);
    return next;
  }

  async touchThread(id: string, at: Date): Promise<void> {
    const thread = this.threads.get(id);
    if (!thread) {
      return;
    }
    this.threads.set(id, { ...thread, updatedAt: at.toISOString() });
  }

  async createMessage(input: CreateMessageInput): Promise<ChatMessageRecord> {
    if (input.role === "assistant" && input.citations.length < 1) {
      throw new CitationsRequiredError();
    }
    const message: ChatMessageRecord = {
      id: randomUUID(),
      threadId: input.threadId,
      role: input.role,
      content: input.content,
      citations: input.citations,
      routing: input.routing,
      createdAt: nowIso(),
    };
    this.messages.set(message.id, message);
    return message;
  }

  async listMessages(
    threadId: string,
    query: ListMessagesQuery,
  ): Promise<{ messages: ChatMessageRecord[]; nextCursor: string | null }> {
    const rows = [...this.messages.values()]
      .filter((message) => message.threadId === threadId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
    const page = pageById(rows, query.limit, query.cursor);
    return { messages: page.rows, nextCursor: page.nextCursor };
  }

  async listRecentMessages(threadId: string, limit: number): Promise<ChatMessageRecord[]> {
    const rows = [...this.messages.values()]
      .filter((message) => message.threadId === threadId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
    return rows.slice(-limit);
  }

  async getMessage(id: string): Promise<ChatMessageRecord | null> {
    return this.messages.get(id) ?? null;
  }

  async createProposal(input: CreateProposalInput): Promise<ChatProposalRecord> {
    const proposal: ChatProposalRecord = {
      id: randomUUID(),
      messageId: input.messageId,
      threadId: input.threadId,
      noteId: input.noteId,
      patch: input.patch,
      status: "pending",
      createdAt: nowIso(),
      resolvedAt: null,
    };
    this.proposals.set(proposal.id, proposal);
    return proposal;
  }

  async listProposals(query: ListProposalsQuery): Promise<ChatProposalRecord[]> {
    return [...this.proposals.values()]
      .filter((proposal) => (query.status ? proposal.status === query.status : true))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, query.limit);
  }

  async getProposal(id: string): Promise<ChatProposalRecord | null> {
    return this.proposals.get(id) ?? null;
  }

  async resolveProposal(
    id: string,
    status: "approved" | "rejected",
    at: Date,
  ): Promise<ChatProposalRecord | null> {
    const proposal = this.proposals.get(id);
    if (!proposal || proposal.status !== "pending") {
      return null;
    }
    const next: ChatProposalRecord = {
      ...proposal,
      status,
      resolvedAt: at.toISOString(),
    };
    this.proposals.set(id, next);
    return next;
  }

  async reopenProposal(id: string): Promise<ChatProposalRecord | null> {
    const proposal = this.proposals.get(id);
    if (!proposal) {
      return null;
    }
    const next: ChatProposalRecord = { ...proposal, status: "pending", resolvedAt: null };
    this.proposals.set(id, next);
    return next;
  }

  async writeAiLog(input: {
    kind: string;
    threadId: string | null;
    payload: Record<string, unknown>;
  }): Promise<AiLogRecord> {
    const log: AiLogRecord = {
      id: randomUUID(),
      kind: input.kind,
      threadId: input.threadId,
      payload: input.payload,
      createdAt: nowIso(),
    };
    this.logs.set(log.id, log);
    return log;
  }

  async listAiLogs(): Promise<AiLogRecord[]> {
    return [...this.logs.values()];
  }

  async purgeAiLogs(before: Date): Promise<number> {
    let removed = 0;
    for (const [id, log] of this.logs) {
      if (new Date(log.createdAt).getTime() < before.getTime()) {
        this.logs.delete(id);
        removed += 1;
      }
    }
    return removed;
  }
}
