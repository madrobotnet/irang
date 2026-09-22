import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, it } from "node:test";
import { POST as CAPTURE } from "../../src/app/api/capture/route";
import { createSession } from "../../src/lib/auth/session";
import { summarizeHtml } from "../../src/lib/capture/summary";
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

it("returns typesafe_misconfigured and does not create a note when the key is missing", async () => {
  delete process.env["TYPESAFE_API_KEY"];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => Promise.resolve(new Response("<title>캡처</title><p>요약</p>", { status: 200 }));
  try {
    const response = await CAPTURE(new Request("http://127.0.0.1/api/capture", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ url: "https://example.invalid/page" }),
    }));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "typesafe_misconfigured" });
    assert.equal((await ctx.database`SELECT id FROM notes`).length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

it("declares an online share target for inbox creation", () => {
  const manifest = JSON.parse(readFileSync(new URL("../../public/manifest.webmanifest", import.meta.url), "utf8")) as {
    share_target?: { action?: string; method?: string };
  };
  assert.equal(manifest.share_target?.action, "/api/inbox");
  assert.equal(manifest.share_target?.method, "POST");
});
