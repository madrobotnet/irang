import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { closeDb, getDb } from "./client";

const migrationsDir = fileURLToPath(new URL("../../db/migrations/", import.meta.url));

export async function migrate(): Promise<void> {
  const files = readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  await getDb().begin(async (sql) => {
    await sql`SELECT pg_advisory_xact_lock(hashtext(current_schema()), hashtext('brain:migrations'))`;
    for (const name of files) {
      await sql.file(resolve(migrationsDir, name));
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await migrate();
  } finally {
    await closeDb();
  }
}
