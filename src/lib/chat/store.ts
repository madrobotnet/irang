import { randomUUID } from "node:crypto";
import { getDb } from "../../db/client";
import { TypeSafeMisconfiguredError, selectEvidence } from "../jev/client";
import { cite, limitContext } from "./context";
import type { ContextNote } from "./context";
import { readCodexAuth } from "./provider";

export function composeReply(question: string, notes: readonly ContextNote[]): string {
  return `${question}에 대한 답입니다. ${cite(notes)}`.trim();
}

const LOG_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function createThread(title: string, now = new Date()): Promise<string> {
  const id = randomUUID();
  await getDb()`INSERT INTO chat_threads (id, title, created_at) VALUES (${id}, ${title}, ${now})`;
  return id;
}

export async function listMessages(threadId: string): Promise<readonly { readonly id: string; readonly role: string; readonly body: string }[]> {
  const rows = await getDb()`
    SELECT id, role, body FROM chat_messages WHERE thread_id = ${threadId} ORDER BY created_at ASC
  `;
  return rows.map((row) => ({ id: String(row["id"]), role: String(row["role"]), body: String(row["body"]) }));
}

async function writeLog(kind: string, body: string, now: Date): Promise<void> {
  const sql = getDb();
  await sql`INSERT INTO ai_logs (id, kind, body, created_at) VALUES (${randomUUID()}, ${kind}, ${body}, ${now})`;
}

export async function reply(threadId: string, question: string, notes: readonly ContextNote[], now = new Date()): Promise<{
  readonly messageId: string;
  readonly body: string;
  readonly citations: readonly string[];
}> {
  readCodexAuth();
  const evidence = await selectEvidence(question, notes);
  if (evidence.length === 0 && process.env["TYPESAFE_API_KEY"]?.trim() === "") {
    throw new TypeSafeMisconfiguredError();
  }
  const chosen = limitContext(notes.filter((note) => evidence.some((item) => item.id === note.id)));
  const citations = chosen.map((note) => note.id);
  const body = composeReply(question, chosen);
  const messageId = randomUUID();
  const sql = getDb();
  await sql`
    INSERT INTO chat_messages (id, thread_id, role, body, created_at)
    VALUES (${randomUUID()}, ${threadId}, 'user', ${question}, ${now})
  `;
  await sql`
    INSERT INTO chat_messages (id, thread_id, role, body, created_at)
    VALUES (${messageId}, ${threadId}, 'assistant', ${body}, ${now})
  `;
  for (const noteId of citations) {
    await sql`INSERT INTO chat_citations (message_id, note_id) VALUES (${messageId}, ${noteId})`;
  }
  await writeLog("chat", body, now);
  return { messageId, body, citations };
}

export async function proposeNoteEdit(noteId: string, proposedBody: string, now = new Date()): Promise<string> {
  const id = randomUUID();
  await getDb()`
    INSERT INTO note_edits (id, note_id, proposed_body, status, created_at)
    VALUES (${id}, ${noteId}, ${proposedBody}, 'pending', ${now})
  `;
  return id;
}

export async function approveNoteEdit(id: string): Promise<boolean> {
  return getDb().begin(async (sql) => {
    const [edit] = await sql`
      SELECT note_id, proposed_body FROM note_edits WHERE id = ${id} AND status = 'pending'
    `;
    if (edit === undefined) return false;
    await sql`UPDATE notes SET body = ${edit["proposed_body"]}, updated_at = now() WHERE id = ${edit["note_id"]}`;
    await sql`UPDATE note_edits SET status = 'applied' WHERE id = ${id}`;
    return true;
  });
}

export async function purgeAiLogs(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - LOG_TTL_MS);
  const rows = await getDb()`DELETE FROM ai_logs WHERE created_at < ${cutoff} RETURNING id`;
  return rows.length;
}
