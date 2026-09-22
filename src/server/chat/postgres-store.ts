import type { Pool } from "pg";
import { CitationsRequiredError } from "@/domain/chat/errors";
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
import type {
  ChatStore,
  CreateMessageInput,
  CreateProposalInput,
  ListMessagesQuery,
  ListProposalsQuery,
  ListThreadsQuery,
} from "./ports";

type ThreadRow = {
  id: string;
  title: string | null;
  created_at: Date;
  updated_at: Date;
  archived_at: Date | null;
};

type MessageRow = {
  id: string;
  thread_id: string;
  role: string;
  content: string;
  citations: unknown;
  routing: unknown;
  created_at: Date;
};

type ProposalRow = {
  id: string;
  message_id: string;
  thread_id: string;
  note_id: string;
  patch: unknown;
  status: string;
  created_at: Date;
  resolved_at: Date | null;
};

type LogRow = {
  id: string;
  kind: string;
  thread_id: string | null;
  payload: unknown;
  created_at: Date;
};

function iso(value: Date): string {
  return value.toISOString();
}

function invalidUuid(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code: string }).code === "22P02");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function mapCitations(value: unknown): StoredCitation[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const citations: StoredCitation[] = [];
  for (const item of value) {
    const row = asRecord(item);
    if (!row || typeof row.noteId !== "string" || typeof row.title !== "string") {
      continue;
    }
    citations.push({
      noteId: row.noteId,
      title: row.title,
      ...(typeof row.snippet === "string" ? { snippet: row.snippet } : {}),
    });
  }
  return citations;
}

function mapRouting(value: unknown): ChatRouteJudgmentDto | null {
  const row = asRecord(value);
  if (!row || row.type !== "choice" || typeof row.choice !== "string" || typeof row.confidence !== "number") {
    return null;
  }
  const probabilities = asRecord(row.probabilities);
  if (!probabilities) {
    return null;
  }
  const mapped: Record<string, number> = {};
  for (const [key, probability] of Object.entries(probabilities)) {
    if (typeof probability === "number") {
      mapped[key] = probability;
    }
  }
  return {
    type: "choice",
    choice: row.choice as ChatRouteJudgmentDto["choice"],
    confidence: row.confidence,
    probabilities: mapped as ChatRouteJudgmentDto["probabilities"],
  };
}

function mapPatch(value: unknown): ProposalPatch {
  const row = asRecord(value) ?? {};
  const patch: ProposalPatch = {};
  if (typeof row.title === "string") {
    patch.title = row.title;
  }
  if (typeof row.body === "string") {
    patch.body = row.body;
  }
  return patch;
}

function mapThread(row: ThreadRow): ChatThreadRecord {
  return {
    id: row.id,
    title: row.title,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    archivedAt: row.archived_at ? iso(row.archived_at) : null,
  };
}

function mapMessage(row: MessageRow): ChatMessageRecord {
  return {
    id: row.id,
    threadId: row.thread_id,
    role: row.role as ChatMessageRole,
    content: row.content,
    citations: mapCitations(row.citations),
    routing: mapRouting(row.routing),
    createdAt: iso(row.created_at),
  };
}

function mapProposal(row: ProposalRow): ChatProposalRecord {
  return {
    id: row.id,
    messageId: row.message_id,
    threadId: row.thread_id,
    noteId: row.note_id,
    patch: mapPatch(row.patch),
    status: row.status as ProposalStatus,
    createdAt: iso(row.created_at),
    resolvedAt: row.resolved_at ? iso(row.resolved_at) : null,
  };
}

function mapLog(row: LogRow): AiLogRecord {
  return {
    id: row.id,
    kind: row.kind,
    threadId: row.thread_id,
    payload: asRecord(row.payload) ?? {},
    createdAt: iso(row.created_at),
  };
}

export class PostgresChatStore implements ChatStore {
  constructor(private readonly pool: Pool) {}

  private async read<T>(work: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (invalidUuid(error)) {
        return fallback;
      }
      throw error;
    }
  }

  async createThread(input: { title: string | null }): Promise<ChatThreadRecord> {
    const { rows } = await this.pool.query<ThreadRow>(
      `INSERT INTO chat_threads (title) VALUES ($1) RETURNING *`,
      [input.title],
    );
    return mapThread(rows[0]);
  }

  async listThreads(query: ListThreadsQuery): Promise<{ threads: ChatThreadRecord[]; nextCursor: string | null }> {
    const params: unknown[] = [query.includeArchived];
    let cursorSql = "";
    if (query.cursor) {
      const cursor = await this.getThread(query.cursor);
      if (cursor) {
        params.push(cursor.updatedAt, cursor.id);
        cursorSql = `AND (updated_at, id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`;
      }
    }
    params.push(query.limit + 1);
    const { rows } = await this.pool.query<ThreadRow>(
      `SELECT * FROM chat_threads
       WHERE ($1::boolean OR archived_at IS NULL)
       ${cursorSql}
       ORDER BY updated_at DESC, id DESC
       LIMIT $${params.length}`,
      params,
    );
    const mapped = rows.map(mapThread);
    let nextCursor: string | null = null;
    if (mapped.length > query.limit) {
      nextCursor = mapped[query.limit - 1]?.id ?? null;
      mapped.length = query.limit;
    }
    return { threads: mapped, nextCursor };
  }

  async getThread(id: string): Promise<ChatThreadRecord | null> {
    return this.read(async () => {
      const { rows } = await this.pool.query<ThreadRow>(`SELECT * FROM chat_threads WHERE id = $1`, [id]);
      return rows[0] ? mapThread(rows[0]) : null;
    }, null);
  }

  async archiveThread(id: string, at: Date): Promise<ChatThreadRecord | null> {
    return this.read(async () => {
      const { rows } = await this.pool.query<ThreadRow>(
        `UPDATE chat_threads
         SET archived_at = COALESCE(archived_at, $2), updated_at = $2
         WHERE id = $1
         RETURNING *`,
        [id, at.toISOString()],
      );
      return rows[0] ? mapThread(rows[0]) : null;
    }, null);
  }

  async touchThread(id: string, at: Date): Promise<void> {
    await this.read(async () => {
      await this.pool.query(`UPDATE chat_threads SET updated_at = $2 WHERE id = $1`, [id, at.toISOString()]);
      return null;
    }, null);
  }

  async createMessage(input: CreateMessageInput): Promise<ChatMessageRecord> {
    if (input.role === "assistant" && input.citations.length < 1) {
      throw new CitationsRequiredError();
    }
    const { rows } = await this.pool.query<MessageRow>(
      `INSERT INTO chat_messages (thread_id, role, content, citations, routing)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
       RETURNING *`,
      [
        input.threadId,
        input.role,
        input.content,
        JSON.stringify(input.citations),
        input.routing ? JSON.stringify(input.routing) : null,
      ],
    );
    return mapMessage(rows[0]);
  }

  async listMessages(
    threadId: string,
    query: ListMessagesQuery,
  ): Promise<{ messages: ChatMessageRecord[]; nextCursor: string | null }> {
    return this.read(async () => {
      const params: unknown[] = [threadId];
      let cursorSql = "";
      if (query.cursor) {
        const cursor = await this.getMessage(query.cursor);
        if (cursor && cursor.threadId === threadId) {
          params.push(cursor.createdAt, cursor.id);
          cursorSql = `AND (created_at, id) > ($${params.length - 1}::timestamptz, $${params.length}::uuid)`;
        }
      }
      params.push(query.limit + 1);
      const { rows } = await this.pool.query<MessageRow>(
        `SELECT * FROM chat_messages
         WHERE thread_id = $1
         ${cursorSql}
         ORDER BY created_at ASC, id ASC
         LIMIT $${params.length}`,
        params,
      );
      const mapped = rows.map(mapMessage);
      let nextCursor: string | null = null;
      if (mapped.length > query.limit) {
        nextCursor = mapped[query.limit - 1]?.id ?? null;
        mapped.length = query.limit;
      }
      return { messages: mapped, nextCursor };
    }, { messages: [], nextCursor: null });
  }

  async listRecentMessages(threadId: string, limit: number): Promise<ChatMessageRecord[]> {
    return this.read(async () => {
      const { rows } = await this.pool.query<MessageRow>(
        `SELECT * FROM chat_messages
         WHERE thread_id = $1
         ORDER BY created_at DESC, id DESC
         LIMIT $2`,
        [threadId, limit],
      );
      return rows.map(mapMessage).reverse();
    }, []);
  }

  async getMessage(id: string): Promise<ChatMessageRecord | null> {
    return this.read(async () => {
      const { rows } = await this.pool.query<MessageRow>(`SELECT * FROM chat_messages WHERE id = $1`, [id]);
      return rows[0] ? mapMessage(rows[0]) : null;
    }, null);
  }

  async createProposal(input: CreateProposalInput): Promise<ChatProposalRecord> {
    const { rows } = await this.pool.query<ProposalRow>(
      `INSERT INTO chat_proposals (message_id, thread_id, note_id, patch)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING *`,
      [input.messageId, input.threadId, input.noteId, JSON.stringify(input.patch)],
    );
    return mapProposal(rows[0]);
  }

  async listProposals(query: ListProposalsQuery): Promise<ChatProposalRecord[]> {
    const params: unknown[] = [];
    let where = "";
    if (query.status) {
      params.push(query.status);
      where = `WHERE status = $1`;
    }
    params.push(query.limit);
    const { rows } = await this.pool.query<ProposalRow>(
      `SELECT * FROM chat_proposals ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length}`,
      params,
    );
    return rows.map(mapProposal);
  }

  async getProposal(id: string): Promise<ChatProposalRecord | null> {
    return this.read(async () => {
      const { rows } = await this.pool.query<ProposalRow>(`SELECT * FROM chat_proposals WHERE id = $1`, [id]);
      return rows[0] ? mapProposal(rows[0]) : null;
    }, null);
  }

  async resolveProposal(
    id: string,
    status: "approved" | "rejected",
    at: Date,
  ): Promise<ChatProposalRecord | null> {
    return this.read(async () => {
      const { rows } = await this.pool.query<ProposalRow>(
        `UPDATE chat_proposals
         SET status = $2, resolved_at = $3
         WHERE id = $1 AND status = 'pending'
         RETURNING *`,
        [id, status, at.toISOString()],
      );
      return rows[0] ? mapProposal(rows[0]) : null;
    }, null);
  }

  async reopenProposal(id: string): Promise<ChatProposalRecord | null> {
    return this.read(async () => {
      const { rows } = await this.pool.query<ProposalRow>(
        `UPDATE chat_proposals
         SET status = 'pending', resolved_at = NULL
         WHERE id = $1
         RETURNING *`,
        [id],
      );
      return rows[0] ? mapProposal(rows[0]) : null;
    }, null);
  }

  async writeAiLog(input: {
    kind: string;
    threadId: string | null;
    payload: Record<string, unknown>;
  }): Promise<AiLogRecord> {
    const { rows } = await this.pool.query<LogRow>(
      `INSERT INTO ai_logs (kind, thread_id, payload)
       VALUES ($1, $2, $3::jsonb)
       RETURNING *`,
      [input.kind, input.threadId, JSON.stringify(input.payload)],
    );
    return mapLog(rows[0]);
  }

  async listAiLogs(): Promise<AiLogRecord[]> {
    const { rows } = await this.pool.query<LogRow>(`SELECT * FROM ai_logs ORDER BY created_at ASC`);
    return rows.map(mapLog);
  }

  async purgeAiLogs(before: Date): Promise<number> {
    const { rowCount } = await this.pool.query(`DELETE FROM ai_logs WHERE created_at < $1`, [before.toISOString()]);
    return rowCount ?? 0;
  }
}
