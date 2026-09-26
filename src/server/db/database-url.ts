/** Postgres connection URL helpers (no secrets in error messages or logs). */

export class DatabaseUrlConfigError extends Error {
  readonly code = "invalid_database_url" as const;

  constructor(message: string) {
    super(message);
    this.name = "DatabaseUrlConfigError";
  }
}

export type PostgresUrlParts = {
  user: string;
  password: string;
  host: string;
  port: number;
  database: string;
};

/** Build a URL with a percent-encoded password (safe for `#`, `@`, etc.). */
export function buildPostgresDatabaseUrl(parts: PostgresUrlParts): string {
  const port = parts.port > 0 ? parts.port : 5432;
  const user = encodeURIComponent(parts.user);
  const password = encodeURIComponent(parts.password);
  const database = encodeURIComponent(parts.database);
  return `postgres://${user}:${password}@${parts.host}:${port}/${database}`;
}

export function validateDatabaseUrl(raw: string): URL {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new DatabaseUrlConfigError("DATABASE_URL is empty");
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new DatabaseUrlConfigError(
      "DATABASE_URL is not a valid URL; percent-encode special characters (e.g. #) in the password",
    );
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new DatabaseUrlConfigError("DATABASE_URL must use postgres:// or postgresql://");
  }
  if (!parsed.hostname) {
    throw new DatabaseUrlConfigError("DATABASE_URL is missing a host");
  }
  return parsed;
}

/** Log-safe label: user@host:port/db without password. */
export function databaseUrlTargetForLog(raw: string): string {
  try {
    const parsed = validateDatabaseUrl(raw);
    const port = parsed.port || "5432";
    const db = parsed.pathname.replace(/^\//, "") || "(no database)";
    const user = parsed.username || "(no user)";
    return `${user}@${parsed.hostname}:${port}/${db}`;
  } catch {
    return "(invalid DATABASE_URL)";
  }
}
