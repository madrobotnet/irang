import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEnvFile } from "node:process";
import { after, before, beforeEach, it } from "node:test";
import { NextRequest } from "next/server";
import postgres from "postgres";
import { POST } from "../../src/app/api/uploads/route";
import { SESSION_COOKIE, createSession } from "../../src/lib/auth/session";
import { closeDb } from "../../src/db/client";
import { migrate } from "../../src/db/migrate";

if (process.env["DATABASE_URL"] === undefined) loadEnvFile("/tmp/sb-e1.env");

const originalUrl = process.env["DATABASE_URL"];
assert.ok(originalUrl, "DATABASE_URL must be set for upload tests");
const schema = `upload_limit_${randomUUID().replaceAll("-", "")}`;
const isolatedUrl = new URL(originalUrl);
isolatedUrl.searchParams.set("search_path", schema);
process.env["DATABASE_URL"] = isolatedUrl.toString();

const uploadDir = join(tmpdir(), `brain-uploads-${randomUUID()}`);
process.env["BRAIN_UPLOAD_DIR"] = uploadDir;

const database = postgres(isolatedUrl.toString(), {
  max: 4,
  connect_timeout: 5,
  idle_timeout: 5,
  connection: { statement_timeout: 10000, client_min_messages: "warning" },
});

before(async () => {
  await database`CREATE SCHEMA ${database(schema)}`;
  await migrate();
}, { timeout: 30_000 });

beforeEach(async () => {
  await database`TRUNCATE attachments, sessions`;
  await rm(uploadDir, { recursive: true, force: true });
});

after(async () => {
  try {
    await closeDb();
    await database`DROP SCHEMA ${database(schema)} CASCADE`;
    await rm(uploadDir, { recursive: true, force: true });
  } finally {
    await database.end();
    process.env["DATABASE_URL"] = originalUrl;
    delete process.env["BRAIN_UPLOAD_DIR"];
  }
});

function uploadRequest(file: File, headers: HeadersInit = {}): NextRequest {
  const form = new FormData();
  form.append("file", file);
  return new NextRequest("http://127.0.0.1/api/uploads", { method: "POST", headers, body: form });
}

it("returns 401 when the session is missing", async () => {
  // Given
  const request = uploadRequest(new File(["# note"], "note.md", { type: "text/markdown" }));
  // When
  const response = await POST(request);
  // Then
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "unauthorized" });
});

it("returns 413 and writes no file when Content-Length is greater than 104857600", async () => {
  // Given
  const session = await createSession({ ip: "192.0.2.10", userAgent: "upload-limit" });
  const request = uploadRequest(new File(["# note"], "note.md", { type: "text/markdown" }), {
    cookie: `${SESSION_COOKIE}=${session.token}`,
    "content-length": "104857601",
  });
  // When
  const response = await POST(request);
  // Then
  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { error: "payload_too_large" });
  assert.equal((await database`SELECT id FROM attachments`).length, 0);
  await assert.rejects(readdir(uploadDir), { code: "ENOENT" });
});

it("returns 415 when the MIME is not allowlisted", async () => {
  // Given
  const session = await createSession({ ip: "192.0.2.10", userAgent: "upload-limit" });
  const request = uploadRequest(new File(["MZ"], "evil.bin", { type: "application/octet-stream" }), {
    cookie: `${SESSION_COOKIE}=${session.token}`,
  });
  // When
  const response = await POST(request);
  // Then
  assert.equal(response.status, 415);
  assert.deepEqual(await response.json(), { error: "unsupported_media_type" });
  assert.equal((await database`SELECT id FROM attachments`).length, 0);
  await assert.rejects(readdir(uploadDir), { code: "ENOENT" });
});
