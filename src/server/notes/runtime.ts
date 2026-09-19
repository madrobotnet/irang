import { loadAuthEnv } from "../auth/runtime";
import { ensureAuthSchema, getPool } from "../db/postgres";
import { ensureNotesSchema, resetNotesSchemaForTests } from "./schema";
import { MemoryNotesStore } from "./memory-store";
import { PostgresNotesStore } from "./postgres-store";
import type { NotesStore } from "./ports";

let store: NotesStore | null = null;

export async function getNotesStore(): Promise<NotesStore> {
  if (store) {
    return store;
  }
  const env = loadAuthEnv();
  if (env.databaseUrl) {
    await ensureAuthSchema(env.databaseUrl);
    await ensureNotesSchema(env.databaseUrl);
    store = new PostgresNotesStore(getPool(env.databaseUrl));
    return store;
  }
  store = new MemoryNotesStore();
  return store;
}

export function setNotesStoreForTests(next: NotesStore | null): void {
  store = next;
}

export function resetNotesRuntimeForTests(): void {
  store = null;
  resetNotesSchemaForTests();
}
