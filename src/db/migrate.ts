import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { closeDb, getDb } from "./client";

export async function migrate(): Promise<void> {
  await getDb().begin(async (sql) => {
    await sql`SELECT pg_advisory_xact_lock(hashtext(current_schema()), hashtext('brain:migrations'))`;
    await sql.file(fileURLToPath(new URL("../../db/migrations/001_auth.sql", import.meta.url)));
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await migrate();
  } finally {
    await closeDb();
  }
}
