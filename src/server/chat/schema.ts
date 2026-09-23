import { getPool } from "../db/postgres";

const CHAT_SCHEMA_SQL = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS chat_threads (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  archived_at  timestamptz NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id    uuid NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  role         text NOT NULL CHECK (role IN ('user','assistant','system')),
  content      text NOT NULL,
  citations    jsonb NOT NULL DEFAULT '[]',
  routing      jsonb NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (
    role <> 'assistant'
    OR (jsonb_typeof(citations) = 'array' AND jsonb_array_length(citations) >= 1)
  )
);

CREATE INDEX IF NOT EXISTS chat_messages_thread_idx
  ON chat_messages (thread_id, created_at, id);

CREATE TABLE IF NOT EXISTS chat_proposals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id   uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  thread_id    uuid NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  note_id      uuid NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  patch        jsonb NOT NULL,
  status       text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','approved','rejected')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  resolved_at  timestamptz NULL
);

CREATE INDEX IF NOT EXISTS chat_proposals_status_idx ON chat_proposals (status, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind         text NOT NULL,
  thread_id    uuid NULL,
  payload      jsonb NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_logs_created_idx ON ai_logs (created_at);
`;

let chatSchemaReady: Promise<void> | null = null;

export async function ensureChatSchema(databaseUrl: string): Promise<void> {
  if (!chatSchemaReady) {
    const pending = (async () => {
      const pool = getPool(databaseUrl);
      await pool.query(CHAT_SCHEMA_SQL);
    })();
    chatSchemaReady = pending;
    try {
      await pending;
    } catch (error) {
      chatSchemaReady = null;
      throw error;
    }
    return;
  }
  await chatSchemaReady;
}

export function resetChatSchemaForTests(): void {
  chatSchemaReady = null;
}
