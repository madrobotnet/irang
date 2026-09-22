import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, it } from "node:test";
import { POST as DISCARD } from "../../src/app/api/inbox/[id]/discard/route";
import { POST as PROMOTE } from "../../src/app/api/inbox/[id]/promote/route";
import { POST as SUGGEST } from "../../src/app/api/inbox/[id]/suggest/route";
import { GET as LIST } from "../../src/app/api/inbox/route";
import { POST as APPLY } from "../../src/app/api/judgments/[id]/apply/route";
import { GET as JOBS } from "../../src/app/api/jobs/route";
import { POST as RETRY } from "../../src/app/api/jobs/[id]/retry/route";
import { createSession } from "../../src/lib/auth/session";
import { saveSuggestion } from "../../src/lib/tags/store";
import { withNotesSchema } from "../notes/fixture.test";

let ctx: Awaited<ReturnType<typeof withNotesSchema>>;
let cookie: string;
const originalKey = process.env["TYPESAFE_API_KEY"];

before(async () => { ctx = await withNotesSchema("inbox_test"); });
beforeEach(async () => {
  await ctx.database`TRUNCATE notes, inbox_items, judgments, tags, note_tags, ai_jobs, sessions CASCADE`;
  cookie = `brain_session=${(await createSession()).token}`;
  delete process.env["TYPESAFE_API_KEY"];
});
after(async () => {
  if (originalKey === undefined) delete process.env["TYPESAFE_API_KEY"];
  else process.env["TYPESAFE_API_KEY"] = originalKey;
  await ctx.close();
});

function context(id: string) {
  return { params: Promise.resolve({ id }) };
}

function authed(path: string, method = "GET") {
  return new Request(`http://127.0.0.1${path}`, { method, headers: { cookie } });
}

async function seedItem() {
  const id = randomUUID();
  await ctx.database`
    INSERT INTO inbox_items (id, title, body, source_url, created_at)
    VALUES (${id}, '읽을 글', '본문', 'https://example.invalid/a', now())
  `;
  return id;
}

it("hides discarded and promoted items from the open list", async () => {
  const open = await seedItem();
  const discarded = await seedItem();
  await DISCARD(authed(`/api/inbox/${discarded}/discard`, "POST"), context(discarded));
  const listed = await LIST(authed("/api/inbox"));
  const body = await listed.json() as { items: { id: string }[] };
  assert.deepEqual(body.items.map((item) => item.id), [open]);
});

it("promotes an inbox item into a note and does not list it again", async () => {
  const id = await seedItem();
  const response = await PROMOTE(authed(`/api/inbox/${id}/promote`, "POST"), context(id));
  assert.equal(response.status, 200);
  const body = await response.json() as { noteId: string };
  const notes = await ctx.database`SELECT title FROM notes WHERE id = ${body.noteId}`;
  assert.equal(notes[0]?.["title"], "읽을 글");
  const listed = await LIST(authed("/api/inbox"));
  assert.equal((await listed.json() as { items: unknown[] }).items.length, 0);
});

it("returns typesafe_misconfigured and applies nothing when the key is missing", async () => {
  const id = await seedItem();
  const response = await SUGGEST(authed(`/api/inbox/${id}/suggest`, "POST"), context(id));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "typesafe_misconfigured" });
  assert.equal((await ctx.database`SELECT id FROM tags`).length, 0);
});

it("applies a stored tag suggestion only after the item is a note", async () => {
  const id = await seedItem();
  const suggestion = await saveSuggestion(id, "독서", 0.82);
  assert.equal((await APPLY(authed(`/api/judgments/${suggestion}/apply`, "POST"), context(suggestion))).status, 404);
  const promoted = await PROMOTE(authed(`/api/inbox/${id}/promote`, "POST"), context(id));
  assert.equal(promoted.status, 200);
  const applied = await APPLY(authed(`/api/judgments/${suggestion}/apply`, "POST"), context(suggestion));
  assert.equal(applied.status, 200);
  assert.deepEqual(await applied.json(), { tag: "독서" });
  const tags = await ctx.database`SELECT name FROM tags`;
  assert.equal(tags[0]?.["name"], "독서");
});

it("retries a failed capture job and clears it from the failed list", async () => {
  const jobId = randomUUID();
  await ctx.database`
    INSERT INTO ai_jobs (id, kind, status, error, attempts, payload, created_at, updated_at)
    VALUES (${jobId}, 'capture', 'failed', 'status 500', 1, ${ctx.database.json({ url: "https://example.invalid/retry" })}, now(), now())
  `;
  const original = globalThis.fetch;
  globalThis.fetch = () => Promise.resolve(new Response("ok", { status: 200 }));
  try {
    const response = await RETRY(authed(`/api/jobs/${jobId}/retry`, "POST"), context(jobId));
    assert.equal(response.status, 200);
  } finally {
    globalThis.fetch = original;
  }
  const jobs = await JOBS(authed("/api/jobs"));
  assert.equal((await jobs.json() as { jobs: unknown[] }).jobs.length, 0);
});
