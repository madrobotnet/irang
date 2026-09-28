import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const directories: string[] = [];
const root = path.resolve(import.meta.dir, "../../..");
const defaults = {
  SESSION_TTL_DAYS: "30",
  ATTACHMENTS_DIR: "/app/.data/attachments",
  TYPESAFE_API_KEY: "",
  TYPESAFE_JEV_MODEL: "jev-latest",
  TYPESAFE_BASE_URL: "https://api.typesafe.ai",
  CODEX_HOME: "/app/.data/auth/codex",
  CODEX_MODEL: "gpt-5.4-mini",
  CODEX_CHATGPT_BASE_URL: "https://chatgpt.com/backend-api/codex",
  GEMINI_CLI_HOME: "/app/.data/auth/google",
} as const;
const overrides = {
  SESSION_TTL_DAYS: "7",
  ATTACHMENTS_DIR: "/app/.data/custom-attachments",
  TYPESAFE_API_KEY: "fixture-jev-key",
  TYPESAFE_JEV_MODEL: "~typesafe/jev-latest",
  TYPESAFE_BASE_URL: "https://openrouter.ai/api",
  CODEX_HOME: "/app/.data/custom-codex",
  CODEX_MODEL: "fixture-chat-model",
  CODEX_CHATGPT_BASE_URL: "https://fixture.example/codex",
  GEMINI_CLI_HOME: "/app/.data/custom-google",
} as const;

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

for (const scenario of [
  { name: "default", values: {}, expected: defaults },
  { name: "operator-provided", values: overrides, expected: overrides },
]) {
  test(`passes ${scenario.name} runtime settings into the app without database admin secrets`, async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "second-brain-compose-"));
    directories.push(directory);
    const file = path.join(directory, ".env");
    const values = {
      POSTGRES_PASSWORD: "fixture-app-password",
      POSTGRES_ADMIN_PASSWORD: "fixture-admin-password",
      SETUP_TOKEN: "fixture-setup-token-for-compose-configuration",
      UNRELATED_SECRET: "fixture-unrelated-secret",
      ...scenario.values,
    };
    await writeFile(file, Object.entries(values).map(([key, value]) => `${key}=${value}`).join("\n"), { mode: 0o600 });

    const child = Bun.spawn(["docker", "compose", "--env-file", file, "-f", "compose.yml", "config", "--format", "json"], {
      cwd: root,
      env: { PATH: process.env.PATH, HOME: process.env.HOME },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited, new Response(child.stdout).text(), new Response(child.stderr).text(),
    ]);
    expect(stderr).toBe("");
    expect(exitCode).toBe(0);
    const config: unknown = JSON.parse(stdout);
    expect(config).toMatchObject({ services: { app: { environment: scenario.expected } } });
    expect(config).not.toHaveProperty("services.app.environment.POSTGRES_ADMIN_PASSWORD");
    expect(config).not.toHaveProperty("services.app.environment.UNRELATED_SECRET");
  });
}
