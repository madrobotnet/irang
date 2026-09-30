import { afterAll, afterEach, beforeEach, expect, test } from "bun:test";
import { once } from "node:events";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer, type Socket } from "node:net";
import path from "node:path";
import type { OAuthCredential } from "@/lib/ai-auth";
import { createGoogleProfileProvider } from "@/server/ai-auth/google-profile";
import { query } from "@/server/db";
import { deleteConnectionProfile, saveConnectionProfile } from "@/server/setup/ai-profiles";
import { saveAiSettings } from "@/server/setup/settings";
import { closeDb, connectTestDatabase, resetData } from "@/server/test/db";
import { configuredChatProvider } from "./connection";
import { ChatProviderError } from "./provider";

connectTestDatabase();
const runtime = Bun.which("node");
if (!runtime) throw new Error("Node is required for CLI fixtures");
const fixtureCommand = { runtime, script: path.join(import.meta.dir, "cli-profile-fixture.ts") };
const originalFetch = globalThis.fetch;
const environment = { PATH: process.env.PATH, GEMINI_CLI_HOME: process.env.GEMINI_CLI_HOME,
  CODEX_HOME: process.env.CODEX_HOME, CODEX_CHATGPT_BASE_URL: process.env.CODEX_CHATGPT_BASE_URL };
let root: string;
beforeEach(async () => {
  await resetData();
  await query("INSERT INTO users (password_hash) VALUES ('fixture')");
  root = await mkdtemp("/tmp/sb-profile-runtime-");
  await mkdir(path.join(root, "bin"));
  await mkdir(path.join(root, ".gemini"));
  await writeFile(path.join(root, "auth.json"), "global-codex-must-not-change");
  await writeFile(path.join(root, ".gemini/oauth_creds.json"), "global-google-must-not-change");
  await writeFile(path.join(root, "bin/gemini"), `#!${runtime}\nimport ${JSON.stringify(fixtureCommand.script)};\n`, { mode: 0o700 });
  process.env.PATH = path.join(root, "bin");
  process.env.GEMINI_CLI_HOME = root;
  process.env.CODEX_HOME = root;
  delete process.env.CODEX_CHATGPT_BASE_URL;
});
afterEach(async () => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(environment)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  await rm(root, { recursive: true, force: true });
});
afterAll(closeDb);

async function save(credential: OAuthCredential) {
  const id = crypto.randomUUID();
  const browserHash = "c".repeat(64);
  await query(`INSERT INTO ai_auth_attempts (id, provider, scope_key, browser_hash, status, payload, expires_at)
    VALUES ($1, $2, (SELECT 'owner:' || id FROM users LIMIT 1), $3, 'ready', $4::jsonb, now() + interval '15 minutes')`,
  [id, credential.provider, browserHash, JSON.stringify(credential)]);
  return saveConnectionProfile({ purpose: "chat", name: "Saved account", consent: true,
    connection: { mode: "auth", provider: credential.provider, model: "fixture-model", authAttemptId: id } }, { browserHash });
}
async function select(id: string) {
  await saveAiSettings({ chat: { mode: "saved", id }, chatConsent: true, jev: null, jevConsent: false });
  const provider = await configuredChatProvider();
  if (!provider) throw new Error("Missing saved provider");
  return provider;
}
const google = (accessToken: string): OAuthCredential => ({ provider: "google", accessToken, refreshToken: `${accessToken}-refresh`, expiresAt: 0 });
const request = (access: string, next: string, extra = {}) => ({ question: JSON.stringify({ access, refresh: `${access}-refresh`, next, ...extra }), history: [], sources: [] });

for (const mode of ["success", "fail"] as const) {
  test(`selected Google profile reaches the CLI and commits refresh on ${mode} without touching global auth`, async () => {
    // Given
    const saved = await save(google("one"));
    const provider = await select(saved.id);
    // When
    const result = provider.stream(request("one", "rotated", { mode }), () => undefined, AbortSignal.timeout(3000));
    // Then
    if (mode === "success") await expect(result).resolves.toBeString();
    else await expect(result).rejects.toEqual(new ChatProviderError());
    const [stored] = await query<{ connection: unknown }>("SELECT connection FROM ai_connections WHERE id = $1", [saved.id]);
    expect(stored?.connection).toMatchObject({ model: "fixture-model", credential: { accessToken: "rotated", refreshToken: "one-refresh" } });
    expect(await readFile(path.join(root, ".gemini/oauth_creds.json"), "utf8")).toBe("global-google-must-not-change");
  });
}

test("Google row locks serialize same-profile refresh, allow independent profiles, and order deletion after readback", async () => {
  // Given: the child signals its exact credential-read point over TCP.
  const first = await save(google("one"));
  const independent = await save(google("two"));
  const server = createServer();
  const connection = Promise.withResolvers<{ socket: Socket; ready: Promise<unknown[]> }>();
  server.once("connection", (socket) => {
    connection.resolve({ socket, ready: once(socket, "data", { signal: AbortSignal.timeout(3000) }) });
  });
  const listening = once(server, "listening", { signal: AbortSignal.timeout(3000) });
  server.listen(0, "127.0.0.1");
  await listening;
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing fixture port");
  let socket: Socket | undefined;
  const firstRun = createGoogleProfileProvider(first.id, { fixtureCommand }).stream(request("one", "rotated", { port: address.port }), () => undefined, AbortSignal.timeout(5000));
  const settled = firstRun.then((text) => ({ text }), (error: unknown) => ({ error }));
  try {
    const connected = await Promise.race([connection.promise, settled.then(() => { throw new Error("Child exited before credential handshake"); })]);
    socket = connected.socket;
    await connected.ready;
    // When: prove the cross-process DB lock, then exercise another profile and deletion.
    await expect(query("SELECT id FROM ai_connections WHERE id = $1 FOR UPDATE NOWAIT", [first.id])).rejects.toMatchObject({ code: "55P03" });
    await expect(createGoogleProfileProvider(independent.id, { fixtureCommand }).stream(request("two", "two-next"), () => undefined, AbortSignal.timeout(3000))).resolves.toBeString();
    const deleted = deleteConnectionProfile(first.id);
    socket.write("release");
    await firstRun;
    await deleted;
    // Then: no stale readback can recreate a deleted profile.
    expect(await query("SELECT id FROM ai_connections WHERE id = $1", [first.id])).toHaveLength(0);
    await expect(createGoogleProfileProvider(first.id, { fixtureCommand }).stream(request("rotated", "unused"), () => undefined, AbortSignal.timeout(3000))).rejects.toEqual(new ChatProviderError());
    expect((await query<{ connection: unknown }>("SELECT connection FROM ai_connections WHERE id = $1", [independent.id]))[0]?.connection)
      .toMatchObject({ credential: { accessToken: "two-next", refreshToken: "two-refresh" } });
  } finally {
    socket?.write("release");
    socket?.destroy();
    server.close();
    await settled;
  }
});

test("stored Codex sessions retain 401 refresh behavior and serialize rotation without a fake auth file", async () => {
  // Given
  const saved = await save({ provider: "openai", accountId: "account-one", accessToken: "old-access", refreshToken: "old-refresh", expiresAt: Date.now() + 3600000 });
  let refreshes = 0;
  const accounts: string[] = [];
  const models: unknown[] = [];
  const server = Bun.serve({ port: 0, async fetch(request) {
    if (request.url.endsWith("/token")) {
      refreshes += 1;
      expect(await request.json()).toMatchObject({ refresh_token: "old-refresh" });
      return Response.json({ access_token: "new-access", refresh_token: "new-refresh", expires_in: 3600 });
    }
    accounts.push(request.headers.get("chatgpt-account-id") ?? "");
    models.push(await request.json());
    if (request.headers.get("authorization") === "Bearer old-access") return new Response(null, { status: 401 });
    expect(request.headers.get("authorization")).toBe("Bearer new-access");
    return new Response('data: {"type":"response.output_text.delta","delta":"answer"}\n\ndata: {"type":"response.completed","response":{}}\n\n');
  } });
  globalThis.fetch = Object.assign((url: RequestInfo | URL, init?: RequestInit) => originalFetch(new URL(new URL(String(url)).pathname, server.url), init), { preconnect: originalFetch.preconnect });
  try {
    const provider = await select(saved.id);
    // When
    const send = () => provider.stream({ question: "test", history: [], sources: [] }, () => undefined, AbortSignal.timeout(3000));
    expect(await Promise.all([send(), send()])).toEqual(["answer", "answer"]);
    // Then
    expect(refreshes).toBe(1);
    expect(new Set(accounts)).toEqual(new Set(["account-one"]));
    for (const model of models) expect(model).toMatchObject({ model: "fixture-model" });
    expect((await query<{ connection: unknown }>("SELECT connection FROM ai_connections WHERE id = $1", [saved.id]))[0]?.connection)
      .toMatchObject({ credential: { accessToken: "new-access", refreshToken: "new-refresh", accountId: "account-one" } });
    expect(await readFile(path.join(root, "auth.json"), "utf8")).toBe("global-codex-must-not-change");
    await deleteConnectionProfile(saved.id);
    await expect(send()).rejects.toEqual(new ChatProviderError());
    expect(refreshes).toBe(1);
  } finally { await server.stop(true); }
});
