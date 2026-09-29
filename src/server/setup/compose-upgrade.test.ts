import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const directories: string[] = [];
const root = path.resolve(import.meta.dir, "../../..");
const modern = {
  POSTGRES_PASSWORD: "fixture-current-app-password",
  POSTGRES_ADMIN_PASSWORD: "fixture-current-admin-password",
  SETUP_TOKEN: "fixture-upgrade-installer-token",
};
const legacy = {
  POSTGRES_PASSWORD: "fixture-legacy-admin-password",
  POSTGRES_APP_PASSWORD: "fixture-app#with@reserved:characters",
  DATABASE_URL: "postgres://second_brain:fixture-app%23with%40reserved%3Acharacters@db:5432/second_brain",
  SETUP_TOKEN: modern.SETUP_TOKEN,
  POSTGRES_DATA_VOLUME: "second_brain_pg18",
};

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function compose(values: Record<string, string>) {
  const directory = await mkdtemp(path.join(tmpdir(), "sb-compose-upgrade-"));
  directories.push(directory);
  const file = path.join(directory, ".env");
  await writeFile(file, Object.entries(values).map(([key, value]) => `${key}=${value}`).join("\n"), { mode: 0o600 });
  const child = Bun.spawn([
    "docker", "compose", "--env-file", file, "-p", "fixture-upgrade",
    "-f", "compose.yml", "config", "--format", "json",
  ], { cwd: root, env: { PATH: process.env.PATH, HOME: process.env.HOME }, stdout: "pipe", stderr: "pipe" });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited, new Response(child.stdout).text(), new Response(child.stderr).text(),
  ]);
  return { exitCode, stdout, stderr };
}

test("keeps the current installation volume and separated database secrets by default", async () => {
  const result = await compose(modern);
  expect(result.exitCode).toBe(0);
  const config: unknown = JSON.parse(result.stdout);
  expect(config).toMatchObject({
    services: {
      app: { environment: { DATABASE_URL: "postgres://second_brain:fixture-current-app-password@db:5432/second_brain" } },
      db: {
        environment: { POSTGRES_PASSWORD: modern.POSTGRES_ADMIN_PASSWORD, POSTGRES_APP_PASSWORD: modern.POSTGRES_PASSWORD },
        volumes: expect.arrayContaining([expect.objectContaining({ type: "volume", source: "postgres-data", target: "/var/lib/postgresql" })]),
      },
    },
    volumes: { "postgres-data": { name: "fixture-upgrade_postgres-data" } },
  });
});

test("mounts the selected legacy database volume instead of creating a new database", async () => {
  const result = await compose({ ...modern, POSTGRES_DATA_VOLUME: "second_brain_pg18" });
  expect(result.exitCode).toBe(0);
  const config: unknown = JSON.parse(result.stdout);
  expect(config).toHaveProperty("services.db.volumes.0.source", "second_brain_pg18");
  expect(config).toHaveProperty("volumes.second_brain_pg18.name", "fixture-upgrade_second_brain_pg18");
});

test("refuses legacy credentials without an explicit data-volume choice", async () => {
  const result = await compose({ ...modern, ...legacy, POSTGRES_DATA_VOLUME: "" });
  expect(result.exitCode).not.toBe(0);
  expect(result.stdout).toBe("");
});

test("still requires a separate admin password for a current installation", async () => {
  const result = await compose({ ...modern, POSTGRES_ADMIN_PASSWORD: "" });
  expect(result.exitCode).not.toBe(0);
  expect(result.stdout).toBe("");
});

test("honors the legacy encoded URL and distinct admin and application passwords", async () => {
  const result = await compose(legacy);
  expect(result.exitCode).toBe(0);
  const config: unknown = JSON.parse(result.stdout);
  expect(config).toMatchObject({ services: {
    app: { environment: { DATABASE_URL: legacy.DATABASE_URL } },
    db: { environment: { POSTGRES_PASSWORD: legacy.POSTGRES_PASSWORD, POSTGRES_APP_PASSWORD: legacy.POSTGRES_APP_PASSWORD } },
  } });
  expect(config).not.toHaveProperty("services.app.environment.POSTGRES_ADMIN_PASSWORD");
  expect(config).not.toHaveProperty("services.app.environment.POSTGRES_APP_PASSWORD");
});

test("keeps an explicitly configured database URL on a current installation", async () => {
  const url = "postgres://fixture:encoded%23password@custom-db:5432/custom";
  const result = await compose({ ...modern, DATABASE_URL: url });
  expect(result.exitCode).toBe(0);
  const config: unknown = JSON.parse(result.stdout);
  expect(config).toHaveProperty("services.app.environment.DATABASE_URL", url);
});
