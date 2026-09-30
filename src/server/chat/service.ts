import type { PoolClient } from "pg";
import type { ChatMessage, ChatThread, Citation } from "@/lib/types";
import type { Locale } from "@/lib/i18n/locale";
import { excerpt } from "@/lib/wikilinks";
import { db, query, queryOne } from "@/server/db";
import { ApiError } from "@/server/http";
import { chatCopy, EMPTY_ANSWER, NEW_THREAD_TITLE } from "@/server/i18n/copy";
import { searchNotes } from "@/server/search/service";
import type { CodexAuth } from "./auth";
import { configuredChatProvider } from "./connection";
import { ChatProviderError, createCodexProvider, type ChatProvider, type ProviderMessage } from "./provider";

type ThreadRow = { id: string; title: string | null; created_at: Date | string; updated_at: Date | string };
type MessageRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: unknown;
  created_at: Date | string;
};
type StreamOptions = { auth?: CodexAuth; provider?: ChatProvider; signal?: AbortSignal; locale?: Locale };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapThread(row: ThreadRow, locale: Locale): ChatThread {
  return { id: row.id, title: row.title || NEW_THREAD_TITLE[locale], createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
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
  if (!UUID.test(id)) throw new ApiError("not_found", chatCopy.threadNotFound);
}

export async function getChatStatus(): Promise<{ available: boolean }> {
  return { available: (await configuredChatProvider()) !== null };
}

export async function listChatThreads(locale: Locale = "ko"): Promise<ChatThread[]> {
  return (await query<ThreadRow>(
    "SELECT id::text, title, created_at, updated_at FROM chat_threads WHERE archived_at IS NULL ORDER BY updated_at DESC, id DESC",
  )).map((row) => mapThread(row, locale));
}

export async function createChatThread(title?: string, locale: Locale = "ko"): Promise<ChatThread> {
  const row = await queryOne<ThreadRow>(
    "INSERT INTO chat_threads (title) VALUES ($1) RETURNING id::text, title, created_at, updated_at",
    [title?.trim() || NEW_THREAD_TITLE[locale]],
  );
  return mapThread(row!, locale);
}

export async function getChatThread(id: string, locale: Locale = "ko"): Promise<{ thread: ChatThread; messages: ChatMessage[] }> {
  validId(id);
  const row = await queryOne<ThreadRow>(
    "SELECT id::text, title, created_at, updated_at FROM chat_threads WHERE id = $1 AND archived_at IS NULL",
    [id],
  );
  if (!row) throw new ApiError("not_found", chatCopy.threadNotFound);
  const messages = await query<MessageRow>(
    `SELECT id::text, role, content, citations, created_at FROM chat_messages
      WHERE thread_id = $1 AND role IN ('user', 'assistant') ORDER BY created_at, id`,
    [id],
  );
  return { thread: mapThread(row, locale), messages: messages.map(mapMessage) };
}

export async function updateChatThread(id: string, title: string, locale: Locale = "ko"): Promise<ChatThread> {
  validId(id);
  const row = await queryOne<ThreadRow>(
    `UPDATE chat_threads SET title = $2, updated_at = now()
      WHERE id = $1 AND archived_at IS NULL RETURNING id::text, title, created_at, updated_at`,
    [id, title.trim()],
  );
  if (!row) throw new ApiError("not_found", chatCopy.threadNotFound);
  return mapThread(row, locale);
}

export async function deleteChatThread(id: string): Promise<void> {
  validId(id);
  const row = await queryOne<{ id: string }>("DELETE FROM chat_threads WHERE id = $1 RETURNING id::text", [id]);
  if (!row) throw new ApiError("not_found", chatCopy.threadNotFound);
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
  const locale = options.locale ?? "ko";
  validId(threadId);
  let provider = options.provider;
  if (!provider) {
    if (options.auth) {
      switch (options.auth.kind) {
        case "chatgpt":
          provider = createCodexProvider(options.auth);
          break;
        case "absent":
        case "blocked":
          break;
        default: {
          const exhaustive: never = options.auth;
          return exhaustive;
        }
      }
    } else {
      provider = await configuredChatProvider() ?? undefined;
    }
  }
  if (!provider) {
    throw new ApiError("unavailable", chatCopy.noProvider);
  }

  const pool = await db();
  const client = await pool.connect();
  await client.query("BEGIN");
  try {
    const lock = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS locked",
      [threadId],
    );
    if (!lock.rows[0]?.locked) throw new ApiError("conflict", chatCopy.busy);
    const thread = await client.query<{ id: string }>(
      "SELECT id::text FROM chat_threads WHERE id = $1 AND archived_at IS NULL FOR UPDATE",
      [threadId],
    );
    if (!thread.rows[0]) throw new ApiError("not_found", chatCopy.threadNotFound);
  } catch (error) {
    await rollback(client);
    throw error;
  }

  const abort = new AbortController();
  const onAbort = (): void => abort.abort();
  if (options.signal?.aborted) abort.abort();
  else options.signal?.addEventListener("abort", onAbort, { once: true });
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
          if (sourceCitations.length === 0) {
            const priorIds = [...new Set(historyResult.rows.flatMap((message) =>
              citations(message.citations).map((citation) => citation.noteId).filter((id) => UUID.test(id)),
            ))].slice(0, 8);
            if (priorIds.length) {
              const prior = await client.query<{ id: string; title: string; body: string }>(
                `SELECT id::text, title, body FROM notes
                  WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL AND status <> 'archived'
                  ORDER BY array_position($1::uuid[], id)`,
                [priorIds],
              );
              sourceCitations.push(...prior.rows.map((note, index) => ({
                index: index + 1, noteId: note.id, title: note.title, excerpt: excerpt(note.body, 220),
              })));
            }
          }
          controller.enqueue(sse("citations", sourceCitations));

          let answer = EMPTY_ANSWER[locale];
          if (sourceCitations.length > 0) {
            const history: ProviderMessage[] = historyResult.rows.reverse().map((message) => ({
              role: message.role,
              content: message.content,
            }));
            answer = await provider.stream({ question: content, history, sources: sourceCitations, locale },
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
              ? chatCopy.upstream[locale]
              : chatCopy.failed[locale];
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
