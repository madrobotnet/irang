import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEnvFile } from "node:process";
import { after, before, beforeEach, it } from "node:test";
import { NextRequest } from "next/server";
import postgres from "postgres";
import { z } from "zod";
import { POST } from "../../src/app/api/uploads/route";
import { SESSION_COOKIE, createSession } from "../../src/lib/auth/session";
import { closeDb } from "../../src/db/client";
import { migrate } from "../../src/db/migrate";

if (process.env["DATABASE_URL"] === undefined) loadEnvFile("/tmp/sb-e1.env");

const originalUrl = process.env["DATABASE_URL"];
assert.ok(originalUrl, "DATABASE_URL must be set for upload tests");
const schema = `upload_test_${randomUUID().replaceAll("-", "")}`;
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

const REQUIRED_MIME_TYPES = [
  "text/markdown",
  "text/plain",
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/zip",
  "audio/mpeg",
  "video/mp4",
] as const;

const storedAttachment = z.object({
  id: z.uuid(),
  filename: z.string(),
  mime: z.string(),
  byteSize: z.number().int().nonnegative(),
  storageKey: z.string(),
}).readonly();

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

async function sessionCookie(): Promise<string> {
  const session = await createSession({ ip: "192.0.2.10", userAgent: "upload-test" });
  return `${SESSION_COOKIE}=${session.token}`;
}

async function attachmentCount(): Promise<number> {
  const [row] = await database<{ readonly count: string }[]>`SELECT count(*)::text AS count FROM attachments`;
  assert.ok(row);
  return Number(row.count);
}

for (const cookie of ["", "brain_session=forged-token"]) {
  it(`returns 401 when the session cookie is ${cookie.length === 0 ? "absent" : "forged"}`, async () => {
    // Given
    const request = uploadRequest(new File(["# note"], "note.md", { type: "text/markdown" }), { cookie });
    // When
    const response = await POST(request);
    // Then
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "unauthorized" });
    assert.equal(await attachmentCount(), 0);
  });
}

it("returns 413 and writes nothing when Content-Length is above 104857600", async () => {
  // Given: a valid session and a small allowed file whose declared length is over the gate.
  const cookie = await sessionCookie();
  const filename = `oversized-${randomUUID()}.md`;
  const request = uploadRequest(new File(["# note"], filename, { type: "text/markdown" }), {
    cookie,
    "content-length": "104857601",
  });
  // When
  const response = await POST(request);
  // Then
  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { error: "payload_too_large" });
  assert.equal(await attachmentCount(), 0);
  await assert.rejects(readdir(uploadDir), { code: "ENOENT" });
});

it("stores a small file when Content-Length is exactly 104857600", async () => {
  // Given
  const cookie = await sessionCookie();
  const request = uploadRequest(new File(["boundary"], "exact.md", { type: "text/plain" }), {
    cookie,
    "content-length": "104857600",
  });
  // When
  const response = await POST(request);
  // Then
  assert.equal(response.status, 201);
  assert.equal(await attachmentCount(), 1);
});

for (const mime of REQUIRED_MIME_TYPES) {
  it(`stores an attachment when the MIME is ${mime}`, async () => {
    // Given
    const cookie = await sessionCookie();
    const payload = `payload-${mime}`;
    const filename = `file-${randomUUID()}`;
    const request = uploadRequest(new File([payload], filename, { type: mime }), { cookie });
    // When
    const response = await POST(request);
    // Then
    assert.equal(response.status, 201);
    const body = storedAttachment.parse(await response.json());
    assert.equal(body.mime, mime);
    assert.equal(body.filename, filename);
    assert.equal(body.byteSize, new TextEncoder().encode(payload).byteLength);
    const [row] = await database<{ readonly mime: string; readonly byte_size: string; readonly storage_key: string }[]>`
      SELECT mime, byte_size::text AS byte_size, storage_key FROM attachments WHERE id = ${body.id}
    `;
    assert.ok(row);
    assert.equal(row.mime, mime);
    assert.equal(row.byte_size, String(body.byteSize));
    assert.equal(row.storage_key, body.storageKey);
    assert.equal(await readFile(join(uploadDir, body.storageKey), "utf8"), payload);
  });
}

it("stores a traversal filename inside the upload directory", async () => {
  // Given
  const cookie = await sessionCookie();
  const request = uploadRequest(new File(["x"], "../../etc/passwd", { type: "text/plain" }), { cookie });
  // When
  const response = await POST(request);
  // Then
  assert.equal(response.status, 201);
  const body = storedAttachment.parse(await response.json());
  assert.equal(body.filename, "passwd");
  assert.deepEqual(await readdir(uploadDir), [body.storageKey]);
});

it("returns 415 and writes nothing when the MIME is not allowlisted", async () => {
  // Given
  const cookie = await sessionCookie();
  const filename = `blocked-${randomUUID()}.bin`;
  const request = uploadRequest(new File(["MZ"], filename, { type: "application/octet-stream" }), { cookie });
  // When
  const response = await POST(request);
  // Then
  assert.equal(response.status, 415);
  assert.deepEqual(await response.json(), { error: "unsupported_media_type" });
  assert.equal(await attachmentCount(), 0);
  await assert.rejects(readdir(uploadDir), { code: "ENOENT" });
});

it("returns 400 when the multipart file field is missing", async () => {
  // Given
  const cookie = await sessionCookie();
  const form = new FormData();
  form.append("title", "not a file");
  const request = new NextRequest("http://127.0.0.1/api/uploads", { method: "POST", headers: { cookie }, body: form });
  // When
  const response = await POST(request);
  // Then
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid_request" });
  assert.equal(await attachmentCount(), 0);
});
