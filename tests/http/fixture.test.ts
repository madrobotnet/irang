import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { cp, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import postgres from "postgres";
import { closeDb } from "../../src/db/client";
import { migrate } from "../../src/db/migrate";

export async function startApp() {
  loadEnvFile("/tmp/sb-e1.env");
  const previousEnv = { ...process.env };
  const databaseUrl = process.env["DATABASE_URL"];
  assert.ok(databaseUrl, "DATABASE_URL is required");
  const schema = `http_test_${randomUUID().replaceAll("-", "")}`;
  const isolatedUrl = new URL(databaseUrl);
  isolatedUrl.searchParams.set("search_path", schema);
  const password = randomUUID();
  Object.assign(process.env, {
    DATABASE_URL: isolatedUrl.toString(),
    BRAIN_GATE_PASSWORD: password,
    BRAIN_COOKIE_SECURE: "false",
    BRAIN_TRUST_PROXY: "true",
  });
  const database = postgres(isolatedUrl.toString(), {
    max: 4, connect_timeout: 5, idle_timeout: 5,
    connection: { statement_timeout: 10000, client_min_messages: "warning" },
  });
  const directory = await mkdtemp(join(tmpdir(), "brain-http-"));
  await database`CREATE SCHEMA ${database(schema)}`;
  await migrate();
  for (const path of ["src", "next.config.ts", "tsconfig.json", "package.json", "next-env.d.ts"]) {
    await cp(resolve(path), join(directory, path), { recursive: true });
  }
  await symlink(resolve("node_modules"), join(directory, "node_modules"), "dir");
  const serverLog = createWriteStream("/tmp/sb-next-http.log");
  const server = spawn("node", [resolve("node_modules/next/dist/bin/next"), "dev", "--webpack", "--port", "0", "--hostname", "127.0.0.1"], {
    cwd: directory, env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" }, stdio: ["ignore", "pipe", "pipe"],
  });
  server.stderr?.pipe(serverLog);
  const exited = new Promise<void>((resolveExit, reject) => {
    server.once("error", reject);
    server.once("close", () => resolveExit());
  });
  const origin = await new Promise<string>((resolveReady, reject) => {
    let output = "";
    let warming = false;
    const timeout = setTimeout(() => reject(new Error("HTTP fixture startup timed out")), 90_000);
    server.once("error", reject);
    server.once("close", () => { clearTimeout(timeout); reject(new Error("HTTP fixture exited before ready")); });
    server.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      const address = output.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
      if (!address || !output.includes("Ready in") || warming) return;
      warming = true;
      clearTimeout(timeout);
      void fetch(new URL("/login", address), { signal: AbortSignal.timeout(60_000) })
        .then(() => fetch(new URL("/", address), { redirect: "manual", signal: AbortSignal.timeout(30_000) }))
        .then(() => resolveReady(address))
        .catch((error: unknown) => reject(error));
    });
  });
  return {
    database, password, origin,
    request(path: string, options: RequestInit = {}) {
      return fetch(new URL(path, origin), { ...options, redirect: "manual", signal: AbortSignal.timeout(30_000) });
    },
    login(passwordInput: string = password, ip = "192.0.2.1") {
      return fetch(new URL("/api/auth/login", origin), {
        method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip },
        body: JSON.stringify({ password: passwordInput }), signal: AbortSignal.timeout(30_000),
      });
    },
    async reset() { await database`TRUNCATE sessions, login_failures, login_locks, audit_events`; },
    async close() {
      server.kill("SIGTERM");
      await exited;
      await closeDb();
      await database`DROP SCHEMA ${database(schema)} CASCADE`;
      await database.end();
      await rm(directory, { recursive: true, force: true });
      for (const key of ["DATABASE_URL", "BRAIN_GATE_PASSWORD", "BRAIN_COOKIE_SECURE", "BRAIN_TRUST_PROXY"]) {
        const value = previousEnv[key];
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    },
  };
}

export function sessionCookie(response: Response): string {
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
  assert.ok(cookie, "Expected a session cookie");
  return cookie;
}
