import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, it } from "node:test";
import { POST as EVIDENCE } from "../../src/app/api/search/evidence/route";
import { POST as INDEX } from "../../src/app/api/search/index/route";
import { GET as SEARCH } from "../../src/app/api/search/route";
import { createSession } from "../../src/lib/auth/session";
import { withNotesSchema } from "../notes/fixture.test";

let ctx: Awaited<ReturnType<typeof withNotesSchema>>;
let cookie: string;
const originalKey = process.env["TYPESAFE_API_KEY"];

before(async () => { ctx = await withNotesSchema("search_test"); });
beforeEach(async () => {
  await ctx.database`TRUNCATE notes, search_docs, tags, note_tags, sessions CASCADE`;
  cookie = `brain_session=${(await createSession()).token}`;
  delete process.env["TYPESAFE_API_KEY"];
});
after(async () => {
  if (originalKey === undefined) delete process.env["TYPESAFE_API_KEY"];
  else process.env["TYPESAFE_API_KEY"] = originalKey;
  await ctx.close();
});

async function seed(title: string, body: string, tag?: string) {
  const id = randomUUID();
  await ctx.database`
    INSERT INTO notes (id, title, body, created_at, updated_at)
    VALUES (${id}, ${title}, ${body}, now(), now())
  `;
  if (tag !== undefined) {
    const tagId = randomUUID();
    await ctx.database`INSERT INTO tags (id, name) VALUES (${tagId}, ${tag}) ON CONFLICT (name) DO NOTHING`;
    const [row] = await ctx.database`SELECT id FROM tags WHERE name = ${tag}`;
    if (row === undefined) throw new Error("tag was not inserted");
    await ctx.database`INSERT INTO note_tags (note_id, tag_id) VALUES (${id}, ${row["id"]})`;
  }
  return id;
}

function authed(path: string, method = "GET", body?: unknown) {
  return new Request(`http://127.0.0.1${path}`, {
    method,
    headers: { cookie, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

it("returns keyword hits and indexing before the nightly batch", async () => {
  const id = await seed("아침 메모", "커피를 마셨다");
  const response = await SEARCH(authed("/api/search?q=커피"));
  assert.equal(response.status, 200);
  const body = await response.json() as { indexStatus: string; hits: { id: string }[] };
  assert.equal(body.indexStatus, "indexing");
  assert.deepEqual(body.hits.map((hit) => hit.id), [id]);
});

it("marks the index ready after the nightly batch", async () => {
  await seed("색인 노트", "본문");
  assert.equal((await INDEX(authed("/api/search/index", "POST"))).status, 200);
  const response = await SEARCH(authed("/api/search?q=색인"));
  const body = await response.json() as { indexStatus: string };
  assert.equal(body.indexStatus, "ready");
});

it("ranks the closer indexed note ahead of a newer keyword match", async () => {
  const older = randomUUID();
  const newer = randomUUID();
  await ctx.database`
    INSERT INTO notes (id, title, body, created_at, updated_at)
    VALUES
      (${older}, '반복', '메모', '2020-01-01', '2020-01-01'),
      (${newer}, '최신', 'zzzz 메모', '2024-01-01', '2024-01-01')
  `;
  await INDEX(authed("/api/search/index", "POST"));
  const response = await SEARCH(authed("/api/search?q=메모"));
  const body = await response.json() as { hits: { id: string }[] };
  assert.equal(body.hits[0]?.id, older);
});

it("filters keyword hits by tag", async () => {
  const tagged = await seed("같은 제목", "본문", "독서");
  await seed("같은 제목", "다른 본문", "요리");
  const response = await SEARCH(authed("/api/search?q=같은&tag=독서"));
  const body = await response.json() as { hits: { id: string }[] };
  assert.deepEqual(body.hits.map((hit) => hit.id), [tagged]);
});

it("does not fall back to keyword hits when evidence selection is misconfigured", async () => {
  await seed("근거", "질문에 대한 본문");
  const response = await EVIDENCE(authed("/api/search/evidence", "POST", { question: "근거" }));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "typesafe_misconfigured" });
});
