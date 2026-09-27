import type { PoolClient } from "pg";
import type { ChatMessage, ChatThread, Citation } from "@/lib/types";
import { db, query, queryOne } from "@/server/db";
import { ApiError } from "@/server/http";
import { searchNotes } from "@/server/search/service";
import { loadCodexAuth, type CodexAuth } from "./auth";
import { ChatProviderError, createCodexProvider, type ChatProvider, type ProviderMessage } from "./provider";

type ThreadRow = { id: string; title: string | null; created_at: Date | string; updated_at: Date | string };
type MessageRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: unknown;
  created_at: Date | string;
};
type StreamOptions = { auth?: CodexAuth; provider?: ChatProvider; signal?: AbortSignal };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMPTY_ANSWER = "관련 노트에서 답변의 근거를 찾지 못했습니다.";

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapThread(row: ThreadRow): ChatThread {
  return { id: row.id, title: row.title || "새 대화", createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
}

function citations(value: unknown): Citation[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, position): Citation[] => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (typeof row.noteId !== "string" || typeof row.title !== "string") return [];
    if (typeof row.index === "number" && typeof row.excerpt === "string") {
      return [{ index: row.index, noteId: row.noteId, title: row.title, excerpt: row.excerpt }];
    }
    return [{
      index: position + 1,
      noteId: row.noteId,
      title: row.title,
      excerpt: typeof row.snippet === "string" ? row.snippet : "",
    }];
  });
}

function mapMessage(row: MessageRow): ChatMessage {
  return { id: row.id, role: row.role, content: row.content, citations: citations(row.citations), createdAt: iso(row.created_at) };
}

function validId(id: string): void {
  if (!UUID.test(id)) throw new ApiError("not_found", "대화를 찾을 수 없습니다.");
}

export async function getChatStatus(): Promise<{ available: boolean }> {
  return { available: (await loadCodexAuth()).kind === "chatgpt" };
}

export async function listChatThreads(): Promise<ChatThread[]> {
  return (await query<ThreadRow>(
    "SELECT id::text, title, created_at, updated_at FROM chat_threads WHERE archived_at IS NULL ORDER BY updated_at DESC, id DESC",
  )).map(mapThread);
}

export async function createChatThread(title?: string): Promise<ChatThread> {
  const row = await queryOne<ThreadRow>(
    "INSERT INTO chat_threads (title) VALUES ($1) RETURNING id::text, title, created_at, updated_at",
    [title?.trim() || "새 대화"],
  );
  return mapThread(row!);
}

export async function getChatThread(id: string): Promise<{ thread: ChatThread; messages: ChatMessage[] }> {
  validId(id);
  const row = await queryOne<ThreadRow>(
    "SELECT id::text, title, created_at, updated_at FROM chat_threads WHERE id = $1 AND archived_at IS NULL",
    [id],
  );
  if (!row) throw new ApiError("not_found", "대화를 찾을 수 없습니다.");
  const messages = await query<MessageRow>(
    `SELECT id::text, role, content, citations, created_at FROM chat_messages
      WHERE thread_id = $1 AND role IN ('user', 'assistant') ORDER BY created_at, id`,
    [id],
  );
  return { thread: mapThread(row), messages: messages.map(mapMessage) };
}

export async function updateChatThread(id: string, title: string): Promise<ChatThread> {
  validId(id);
  const row = await queryOne<ThreadRow>(
    `UPDATE chat_threads SET title = $2, updated_at = now()
      WHERE id = $1 AND archived_at IS NULL RETURNING id::text, title, created_at, updated_at`,
    [id, title.trim()],
  );
  if (!row) throw new ApiError("not_found", "대화를 찾을 수 없습니다.");
  return mapThread(row);
}

export async function deleteChatThread(id: string): Promise<void> {
  validId(id);
  const row = await queryOne<{ id: string }>("DELETE FROM chat_threads WHERE id = $1 RETURNING id::text", [id]);
  if (!row) throw new ApiError("not_found", "대화를 찾을 수 없습니다.");
}

function sse(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function rollback(client: PoolClient): Promise<void> {
  await client.query("ROLLBACK").catch(() => undefined);
  client.release();
}

export async function createChatMessageStream(
  threadId: string,
  content: string,
  options: StreamOptions = {},
): Promise<Response> {
  validId(threadId);
  const auth = options.auth ?? await loadCodexAuth();
  if (auth.kind !== "chatgpt" && !options.provider) {
    throw new ApiError("unavailable", "Codex 로그인이 필요합니다.");
  }

  const pool = await db();
  const client = await pool.connect();
  await client.query("BEGIN");
  try {
    const lock = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS locked",
      [threadId],
    );
    if (!lock.rows[0]?.locked) throw new ApiError("conflict", "이 대화의 답변을 이미 생성하고 있습니다.");
    const thread = await client.query<{ id: string }>(
      "SELECT id::text FROM chat_threads WHERE id = $1 AND archived_at IS NULL FOR UPDATE",
      [threadId],
    );
    if (!thread.rows[0]) throw new ApiError("not_found", "대화를 찾을 수 없습니다.");
  } catch (error) {
    await rollback(client);
    throw error;
  }

  const abort = new AbortController();
  const onAbort = (): void => abort.abort();
  if (options.signal?.aborted) abort.abort();
  else options.signal?.addEventListener("abort", onAbort, { once: true });
  const provider = options.provider ?? createCodexProvider(auth as Extract<CodexAuth, { kind: "chatgpt" }>);
  let settled = false;

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      void (async () => {
        try {
          const historyResult = await client.query<MessageRow>(
            `SELECT id::text, role, content, citations, created_at FROM chat_messages
              WHERE thread_id = $1 AND role IN ('user', 'assistant')
              ORDER BY created_at DESC, id DESC LIMIT 12`,
            [threadId],
          );
          const search = await searchNotes(content, { limit: 8 });
          abort.signal.throwIfAborted();
          const sourceCitations: Citation[] = search.hits.map((hit, index) => ({
            index: index + 1,
            noteId: hit.noteId,
            title: hit.title,
            excerpt: hit.snippet,
          }));
          controller.enqueue(sse("citations", sourceCitations));

          let answer = EMPTY_ANSWER;
          if (sourceCitations.length > 0) {
            const history: ProviderMessage[] = historyResult.rows.reverse().map((message) => ({
              role: message.role,
              content: message.content,
            }));
            answer = await provider.stream({ question: content, history, sources: sourceCitations },
              (text) => controller.enqueue(sse("delta", { text })), abort.signal);
          } else {
            controller.enqueue(sse("delta", { text: answer }));
          }

          abort.signal.throwIfAborted();
          const user = await client.query<{ created_at: Date }>(
            `INSERT INTO chat_messages (thread_id, role, content, citations)
              VALUES ($1, 'user', $2, '[]'::jsonb) RETURNING created_at`,
            [threadId, content],
          );
          const inserted = await client.query<MessageRow>(
            `INSERT INTO chat_messages (thread_id, role, content, citations, created_at)
              VALUES ($1, 'assistant', $2, $3::jsonb, greatest(clock_timestamp(), $4::timestamptz + interval '1 microsecond'))
              RETURNING id::text, role, content, citations, created_at`,
            [threadId, answer, JSON.stringify(sourceCitations), user.rows[0]!.created_at],
          );
          await client.query("UPDATE chat_threads SET updated_at = now() WHERE id = $1", [threadId]);
          await client.query("COMMIT");
          settled = true;
          controller.enqueue(sse("done", { message: mapMessage(inserted.rows[0]!) }));
          controller.close();
        } catch (error) {
          if (!settled) await client.query("ROLLBACK").catch(() => undefined);
          settled = true;
          if (!abort.signal.aborted) {
            const code = error instanceof ChatProviderError ? "upstream_failed" : "internal";
            const message = error instanceof ChatProviderError
              ? "채팅 모델 응답을 받지 못했습니다."
              : "답변을 생성하지 못했습니다.";
            controller.enqueue(sse("error", { code, message }));
            controller.close();
          }
        } finally {
          options.signal?.removeEventListener("abort", onAbort);
          client.release();
        }
      })();
    },
    cancel() {
      abort.abort();
    },
  });
  return new Response(body, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
