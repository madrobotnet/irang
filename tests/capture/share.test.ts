import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, it } from "node:test";
import { z } from "zod";
import { POST as CAPTURE } from "../../src/app/api/capture/route";
import { POST as INBOX } from "../../src/app/api/inbox/route";
import { createSession } from "../../src/lib/auth/session";
import { summarizeHtml } from "../../src/lib/capture/summary";
import { createNote } from "../../src/lib/notes/store";
import { withNotesSchema } from "../notes/fixture.test";

let ctx: Awaited<ReturnType<typeof withNotesSchema>>;
let cookie: string;
const originalKey = process.env["TYPESAFE_API_KEY"];

before(async () => {
  ctx = await withNotesSchema("capture_test");
  const session = await createSession();
  cookie = `brain_session=${session.token}`;
});

after(async () => {
  if (originalKey === undefined) delete process.env["TYPESAFE_API_KEY"];
  else process.env["TYPESAFE_API_KEY"] = originalKey;
  await ctx.close();
});

it("keeps only a short text summary when HTML is captured", () => {
  const html = `<html><head><title>제목</title><style>body{}</style></head><body><script>alert(1)</script><p>${"가".repeat(1200)}</p></body></html>`;
  const summary = summarizeHtml(html, "https://example.invalid/note");
  assert.equal(summary.title, "제목");
  assert.equal(summary.body.includes("<"), false);
  assert.equal(summary.body.length <= 1000, true);
});

it("returns 401 when the session is missing", async () => {
  // Given: no cookie
  const capture = new Request("http://127.0.0.1/api/capture", { method: "POST" });
  const inbox = new Request("http://127.0.0.1/api/inbox", { method: "POST" });
  // When
  const captureResponse = await CAPTURE(capture);
  const inboxResponse = await INBOX(inbox);
  // Then
  assert.equal(captureResponse.status, 401);
  assert.equal(inboxResponse.status, 401);
  assert.deepEqual(await captureResponse.json(), { error: "unauthorized" });
  assert.deepEqual(await inboxResponse.json(), { error: "unauthorized" });
});

it("returns typesafe_misconfigured and does not create a note when the key is missing", async () => {
  // Given: no API key, and a page fetch that must not reach TypeSafe
  delete process.env["TYPESAFE_API_KEY"];
  const before = (await ctx.database`SELECT id FROM notes`).length;
  let typesafeCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input) => {
    if (String(input).includes("api.typesafe.ai")) typesafeCalled = true;
    return Promise.resolve(new Response("<title>캡처</title><p>요약</p>", { status: 200 }));
  };
  try {
    // When
    const response = await CAPTURE(new Request("http://127.0.0.1/api/capture", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ url: "https://example.invalid/page" }),
    }));
    // Then
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "typesafe_misconfigured" });
    assert.equal((await ctx.database`SELECT id FROM notes`).length, before);
    assert.equal(typesafeCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

it("rejects a non-http capture URL before fetching", async () => {
  // Given
  let fetched = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => {
    fetched = true;
    return Promise.reject(new Error("must not fetch"));
  };
  try {
    // When
    const response = await CAPTURE(new Request("http://127.0.0.1/api/capture", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ url: "javascript:alert(1)" }),
    }));
    // Then
    assert.equal(response.status, 400);
    assert.equal(fetched, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

const captureResult = z.object({
  noteId: z.uuid(),
  candidates: z.array(z.object({
    noteId: z.uuid(),
    probability: z.number(),
  }).readonly()),
}).readonly();

it("stores extracted text and candidate probabilities without merging", async () => {
  // Given: an existing note and a page whose HTML is longer than the stored summary
  process.env["TYPESAFE_API_KEY"] = "capture-test-key";
  const existing = await createNote({ title: "기존 노트", body: "병합하지 말 것" });
  const html = `<html><head><title>캡처 제목</title><style>body{}</style></head><body><script>secret()</script><p>${"나".repeat(1500)}</p></body></html>`;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const target = String(input);
    if (target.includes("api.typesafe.ai")) {
      const questions = z.object({ questions: z.record(z.string(), z.unknown()) }).parse(JSON.parse(String(init?.body)));
      const answers = Object.fromEntries(Object.keys(questions.questions).map((id) => [id, { type: "noul", noul: 0.64 }]));
      return Promise.resolve(new Response(JSON.stringify({
        model: "jev-latest",
        answers,
        usage: { input_tokens: 1, output_tokens: 1 },
      }), { status: 200, headers: { "content-type": "application/json" } }));
    }
    return Promise.resolve(new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }));
  };
  try {
    // When
    const response = await CAPTURE(new Request("http://127.0.0.1/api/capture", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ url: "https://example.invalid/article" }),
    }));
    // Then
    assert.equal(response.status, 201);
    const payload = captureResult.parse(await response.json());
    assert.deepEqual(payload.candidates, [{ noteId: existing.id, probability: 0.64 }]);
    const [created] = await ctx.database<{ readonly title: string; readonly body: string }[]>`
      SELECT title, body FROM notes WHERE id = ${payload.noteId}
    `;
    const [untouched] = await ctx.database<{ readonly title: string; readonly body: string }[]>`
      SELECT title, body FROM notes WHERE id = ${existing.id}
    `;
    assert.ok(created);
    assert.equal(created.title, "캡처 제목");
    assert.equal(created.body.includes("<"), false);
    assert.equal(created.body.includes("secret"), false);
    assert.equal(created.body.length <= 1000, true);
    assert.equal(created.body.includes("나"), true);
    assert.equal(untouched?.title, "기존 노트");
    assert.equal(untouched?.body, "병합하지 말 것");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

it("returns 400 and does not insert when inbox JSON is invalid", async () => {
  // Given
  const before = (await ctx.database`SELECT id FROM inbox_items`).length;
  // When
  const response = await INBOX(new Request("http://127.0.0.1/api/inbox", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: "{",
  }));
  // Then
  assert.equal(response.status, 400);
  assert.equal((await ctx.database`SELECT id FROM inbox_items`).length, before);
});

it("inserts an inbox item from the share target fields", async () => {
  // Given: multipart fields the manifest posts
  const form = new FormData();
  form.append("title", "공유 제목");
  form.append("text", "공유 본문");
  form.append("url", "https://capture.test/shared");
  // When
  const response = await INBOX(new Request("http://127.0.0.1/api/inbox", {
    method: "POST",
    headers: { cookie },
    body: form,
  }));
  // Then
  assert.equal(response.status, 201);
  const payload = z.object({ id: z.uuid() }).parse(await response.json());
  const [row] = await ctx.database<{ readonly title: string; readonly body: string; readonly source_url: string }[]>`
    SELECT title, body, source_url FROM inbox_items WHERE id = ${payload.id}
  `;
  assert.equal(row?.title, "공유 제목");
  assert.equal(row?.body, "공유 본문");
  assert.equal(row?.source_url, "https://capture.test/shared");
});

it("declares an online share target for inbox creation", () => {
  const manifest = JSON.parse(readFileSync(new URL("../../public/manifest.webmanifest", import.meta.url), "utf8")) as {
    share_target?: { action?: string; method?: string };
  };
  assert.equal(manifest.share_target?.action, "/api/inbox");
  assert.equal(manifest.share_target?.method, "POST");
});
