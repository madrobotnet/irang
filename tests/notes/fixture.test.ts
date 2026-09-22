import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadEnvFile } from "node:process";
import postgres from "postgres";
import { closeDb } from "../../src/db/client";
import { migrate } from "../../src/db/migrate";

export async function withNotesSchema(prefix: string) {
  if (!process.env["DATABASE_URL"]) loadEnvFile("/tmp/sb-e1.env");
  const originalUrl = process.env["DATABASE_URL"];
  assert.ok(originalUrl, "DATABASE_URL must be set (directly or via /tmp/sb-e1.env)");
  const schema = `${prefix}_${randomUUID().replaceAll("-", "")}`;
  const isolatedUrl = new URL(originalUrl);
  isolatedUrl.searchParams.set("search_path", schema);
  process.env["DATABASE_URL"] = isolatedUrl.toString();
  const database = postgres(isolatedUrl.toString(), {
    max: 4,
    connect_timeout: 5,
    idle_timeout: 5,
    connection: { statement_timeout: 10000, client_min_messages: "warning" },
  });
  await database`CREATE SCHEMA ${database(schema)}`;
  await migrate();
  return {
    database,
    async close() {
      try {
        await closeDb();
        await database`DROP SCHEMA ${database(schema)} CASCADE`;
      } finally {
        await database.end();
        process.env["DATABASE_URL"] = originalUrl;
      }
    },
  };
}
