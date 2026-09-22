import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, it } from "node:test";
import { POST as MESSAGE } from "../../src/app/api/chat/threads/[id]/messages/route";
import { limitContext, MAX_CONTEXT_CHARS, MAX_CONTEXT_NOTES } from "../../src/lib/chat/context";
import { approveNoteEdit, composeReply, createThread, proposeNoteEdit, purgeAiLogs } from "../../src/lib/chat/store";
import { createSession } from "../../src/lib/auth/session";
import { withNotesSchema } from "../notes/fixture.test";

let ctx: Awaited<ReturnType<typeof withNotesSchema>>;
let cookie: string;
const originalCodex = process.env["CODEX_AUTH"];
const originalKey = process.env["TYPESAFE_API_KEY"];

before(async () => { ctx = await withNotesSchema("chat_test"); });
beforeEach(async () => {
  await ctx.database`TRUNCATE notes, chat_threads, chat_messages, chat_citations, ai_logs, note_edits, sessions CASCADE`;
  cookie = `brain_session=${(await createSession()).token}`;
  delete process.env["CODEX_AUTH"];
  delete process.env["TYPESAFE_API_KEY"];
});
after(async () => {
  if (originalCodex === undefined) delete process.env["CODEX_AUTH"];
  else process.env["CODEX_AUTH"] = originalCodex;
  if (originalKey === undefined) delete process.env["TYPESAFE_API_KEY"];
  else process.env["TYPESAFE_API_KEY"] = originalKey;
  await ctx.close();
});

it("keeps at most 10 notes and 32000 characters of context", () => {
  const notes = Array.from({ length: 12 }, (_, index) => ({
    id: randomUUID(),
    title: `노트 ${index}`,
    body: "가".repeat(4000),
  }));
  const limited = limitContext(notes);
  assert.equal(limited.length <= MAX_CONTEXT_NOTES, true);
  assert.equal(limited.reduce((sum, note) => sum + note.body.length, 0) <= MAX_CONTEXT_CHARS, true);
});

it("returns codex_misconfigured and stores no assistant message when Codex auth is missing", async () => {
  const threadId = await createThread("대화");
  const response = await MESSAGE(new Request("http://127.0.0.1/api/chat", {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ question: "이 노트의 요점은?" }),
  }), { params: Promise.resolve({ id: threadId }) });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "codex_misconfigured" });
  assert.equal((await ctx.database`SELECT id FROM chat_messages`).length, 0);
});

it("returns typesafe_misconfigured instead of an uncited keyword answer", async () => {
  process.env["CODEX_AUTH"] = "present-for-test";
  const threadId = await createThread("대화");
  const noteId = randomUUID();
  await ctx.database`
    INSERT INTO notes (id, title, body, created_at, updated_at)
    VALUES (${noteId}, '출처', '본문', now(), now())
  `;
  const response = await MESSAGE(new Request("http://127.0.0.1/api/chat", {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ question: "출처" }),
  }), { params: Promise.resolve({ id: threadId }) });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "typesafe_misconfigured" });
});

it("does not change a note until the proposed edit is approved", async () => {
  const noteId = randomUUID();
  await ctx.database`
    INSERT INTO notes (id, title, body, created_at, updated_at)
    VALUES (${noteId}, '원문', '그대로', now(), now())
  `;
  const editId = await proposeNoteEdit(noteId, "고친 본문");
  const before = await ctx.database`SELECT body FROM notes WHERE id = ${noteId}`;
  assert.equal(before[0]?.["body"], "그대로");
  assert.equal(await approveNoteEdit(editId), true);
  const after = await ctx.database`SELECT body FROM notes WHERE id = ${noteId}`;
  assert.equal(after[0]?.["body"], "고친 본문");
});

it("deletes AI logs older than 7 days", async () => {
  const old = new Date("2020-01-01T00:00:00Z");
  await ctx.database`
    INSERT INTO ai_logs (id, kind, body, created_at)
    VALUES (${randomUUID()}, 'chat', '오래된 로그', ${old})
  `;
  await ctx.database`
    INSERT INTO ai_logs (id, kind, body, created_at)
    VALUES (${randomUUID()}, 'chat', '최근 로그', now())
  `;
  assert.equal(await purgeAiLogs(new Date("2020-01-09T00:00:00Z")), 1);
  const remaining = await ctx.database`SELECT body FROM ai_logs`;
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0]?.["body"], "최근 로그");
});

it("includes a source note link in the composed answer", () => {
  const noteId = "11111111-1111-1111-1111-111111111111";
  const body = composeReply("출처 노트", [{ id: noteId, title: "출처 노트", body: "답에 필요한 본문" }]);
  assert.equal(body.includes(`/notes/${noteId}`), true);
});
