import { closeDb, query } from "@/server/db";

/** Default matches docker-compose.dev.yml (npm run db:up). */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://second_brain:second_brain@127.0.0.1:55432/second_brain_test";
// Parallel development lanes may point TEST_DATABASE_URL at their own database (sb_test_<lane>).

/** Point the app at the test database. Call at the top of every integration test file. */
export function connectTestDatabase(): void {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
}

/** Wipe all user data between tests (schema stays migrated). */
export async function resetData(): Promise<void> {
  await query(
    "TRUNCATE chat_messages, chat_threads, attachments, unresolved_links, links, inbox_items, notes, sessions, users, auth_login_failures RESTART IDENTITY CASCADE",
  );
}

export { closeDb };
