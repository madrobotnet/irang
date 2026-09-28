import { afterEach, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

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
