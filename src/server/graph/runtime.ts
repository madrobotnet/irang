import { loadAuthEnv } from "../auth/runtime";
import { ensureAuthSchema, getPool } from "../db/postgres";
import { ensureNotesSchema } from "../notes/schema";
import { MemoryLinkStore } from "./memory-store";
import { PostgresLinkStore } from "./postgres-store";
import type { LinkStore } from "./ports";
import { ensureGraphSchema, resetGraphSchemaForTests } from "./schema";

let store: LinkStore | null = null;

export async function getLinkStore(): Promise<LinkStore> {
  if (store) {
    return store;
  }
  const env = loadAuthEnv();
  if (env.databaseUrl) {
    await ensureAuthSchema(env.databaseUrl);
    await ensureNotesSchema(env.databaseUrl);
    await ensureGraphSchema(env.databaseUrl);
    store = new PostgresLinkStore(getPool(env.databaseUrl));
    return store;
  }
  store = new MemoryLinkStore();
  return store;
}

export function setLinkStoreForTests(next: LinkStore | null): void {
  store = next;
}

export function resetLinkRuntimeForTests(): void {
  store = null;
  resetGraphSchemaForTests();
}
