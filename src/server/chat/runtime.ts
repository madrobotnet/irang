import { loadAuthEnv } from "../auth/runtime";
import { getPool } from "../db/postgres";
import { ensureNotesSchema } from "../notes/schema";
import { MemoryChatStore } from "./memory-store";
import { PostgresChatStore } from "./postgres-store";
import type { ChatStore } from "./ports";
import { ensureChatSchema, resetChatSchemaForTests } from "./schema";

let store: ChatStore | null = null;

export async function getChatStore(): Promise<ChatStore> {
  if (store) {
    return store;
  }
  const env = loadAuthEnv();
  if (!env.databaseUrl) {
    store = new MemoryChatStore();
    return store;
  }
  await ensureNotesSchema(env.databaseUrl);
  await ensureChatSchema(env.databaseUrl);
  store = new PostgresChatStore(getPool(env.databaseUrl));
  return store;
}

export function setChatStoreForTests(next: ChatStore | null): void {
  store = next;
}

export function resetChatRuntimeForTests(): void {
  store = null;
  resetChatSchemaForTests();
}
