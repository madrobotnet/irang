import { afterEach, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { z } from "zod";

const directories: string[] = [];
const script = path.resolve(import.meta.dir, "../../..", "scripts/setup-env.mjs");

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

test("creates private distinct installer and database secrets through the bootstrap CLI", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "second-brain-bootstrap-"));
  directories.push(directory);
  const file = path.join(directory, ".env");
  const process = Bun.spawn([Bun.which("bun") ?? "bun", "--no-env-file", script, file], { stdout: "pipe", stderr: "pipe" });
  const [exitCode, stdout] = await Promise.all([process.exited, new Response(process.stdout).text()]);
  expect(exitCode).toBe(0);
  const content = await readFile(file, "utf8");
  const values = Object.fromEntries(content.split("\n").filter((line) => line && !line.startsWith("#")).map((line) => {
    const boundary = line.indexOf("=");
    return [line.slice(0, boundary), line.slice(boundary + 1)];
  }));
  expect(values.SETUP_TOKEN).toMatch(/^[a-f0-9]{64}$/);
  expect(values.POSTGRES_PASSWORD).toMatch(/^[a-f0-9]{64}$/);
  expect(values.POSTGRES_ADMIN_PASSWORD).toMatch(/^[a-f0-9]{64}$/);
  expect(new Set([values.SETUP_TOKEN, values.POSTGRES_PASSWORD, values.POSTGRES_ADMIN_PASSWORD]).size).toBe(3);
  expect(values.INSECURE_COOKIES).toBe("0");
  expect((await stat(file)).mode & 0o777).toBe(0o600);
  expect(stdout).not.toContain(values.POSTGRES_PASSWORD);
  expect(stdout).not.toContain(values.POSTGRES_ADMIN_PASSWORD);
});

test("refuses to overwrite an existing environment file", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "second-brain-bootstrap-"));
  directories.push(directory);
  const file = path.join(directory, ".env");
  const first = Bun.spawn([Bun.which("bun") ?? "bun", "--no-env-file", script, file], { stdout: "ignore", stderr: "pipe" });
  expect(await first.exited).toBe(0);
  const original = await readFile(file, "utf8");
  const second = Bun.spawn([Bun.which("bun") ?? "bun", "--no-env-file", script, file], { stdout: "ignore", stderr: "pipe" });
  expect(await second.exited).toBe(1);
  expect(await readFile(file, "utf8")).toBe(original);
});

test("exports a password hash that survives Compose dotenv parsing", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "second-brain-password-env-"));
  directories.push(directory);
  const root = path.resolve(path.dirname(script), "..");
  const password = "fixture-Compose-literal-hash";
  const child = Bun.spawn([Bun.which("bun") ?? "bun", "--no-env-file", path.join(root, "scripts/hash-password.mjs"), "--env"], {
    stdin: "pipe", stdout: "pipe", stderr: "pipe",
  });
  const output = new Response(child.stdout).text();
  const errors = new Response(child.stderr).text();
  child.stdin.write(`${password}\n`);
  child.stdin.end();
  expect(await child.exited).toBe(0);
  const exported = await output;
  await errors;
  const file = path.join(directory, ".env");
  await writeFile(file, [
    "SESSION_SECRET=fixture-session-secret",
    `SETUP_TOKEN=${"a".repeat(64)}`,
    "POSTGRES_PASSWORD=fixture-app-password",
    "POSTGRES_ADMIN_PASSWORD=fixture-admin-password",
    exported,
  ].join("\n"), { mode: 0o600 });
  const compose = Bun.spawn(["docker", "compose", "-f", path.join(root, "compose.yml"), "--env-file", file, "config", "--format", "json"], {
    env: { PATH: process.env.PATH }, stdout: "pipe", stderr: "pipe",
  });
  const json = new Response(compose.stdout).text();
  const diagnostics = new Response(compose.stderr).text();
  const composeExit = await compose.exited;
  const composeErrors = await diagnostics;
  expect(composeExit, composeErrors).toBe(0);
  const config = z.object({
    services: z.object({
      app: z.object({ environment: z.object({ AUTH_PASSWORD_HASH: z.string() }) }),
    }),
  }).parse(JSON.parse(await json));
  const hash = config.services.app.environment.AUTH_PASSWORD_HASH.replaceAll("$$", "$");
  expect(hash.slice(0, 10)).toBe("$argon2id$");
  expect(await Bun.password.verify(password, hash)).toBe(true);
});
