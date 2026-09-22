import postgres from "postgres";
import { z } from "zod";

const databaseUrl = z.url().refine((url) => /^postgres(?:ql)?:\/\//.test(url));
let connection: postgres.Sql | undefined;

export class DatabaseMisconfiguredError extends Error {
  readonly name = "DatabaseMisconfiguredError";

  constructor() {
    super("DATABASE_URL must be a valid Postgres connection URL");
  }
}

export function getDb(): postgres.Sql {
  if (connection) return connection;
  const url = databaseUrl.safeParse(process.env["DATABASE_URL"]).data;
  if (url === undefined) throw new DatabaseMisconfiguredError();
  connection = postgres(url, {
    max: 4,
    connect_timeout: 5,
    idle_timeout: 20,
    max_lifetime: 1800,
    connection: { statement_timeout: 10000, client_min_messages: "warning" },
  });
  return connection;
}

export async function closeDb(): Promise<void> {
  if (connection) {
    await connection.end({ timeout: 5 });
    connection = undefined;
  }
}
