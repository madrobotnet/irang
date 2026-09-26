#!/usr/bin/env node
/**
 * Print a percent-encoded postgres DATABASE_URL for Compose / .env.
 * Usage: node scripts/build-database-url.mjs [host] [port] [database]
 * Reads POSTGRES_APP_USER (default second_brain) and POSTGRES_APP_PASSWORD from the environment.
 * Never prints the raw password — only the full URL on stdout (redirect to .env locally).
 */
const user = process.env.POSTGRES_APP_USER ?? "second_brain";
const password = process.env.POSTGRES_APP_PASSWORD ?? "";
if (!password) {
  console.error("POSTGRES_APP_PASSWORD is required");
  process.exit(1);
}
const host = process.argv[2] ?? "db";
const port = Number(process.argv[3] ?? "5432");
const database = process.argv[4] ?? "second_brain";
const encUser = encodeURIComponent(user);
const encPass = encodeURIComponent(password);
const encDb = encodeURIComponent(database);
process.stdout.write(`postgres://${encUser}:${encPass}@${host}:${port}/${encDb}`);
