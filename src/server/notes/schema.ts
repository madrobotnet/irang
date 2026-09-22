import { getPool } from "../db/postgres";

const NOTES_SCHEMA_SQL = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  body        text NOT NULL,
  status      text NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','confirmed','archived')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz NULL,
  purge_at    timestamptz NULL
);

CREATE INDEX IF NOT EXISTS notes_active_updated_idx
  ON notes (updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS notes_purge_idx ON notes (purge_at)
  WHERE deleted_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS inbox_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title             text NOT NULL,
  body              text NOT NULL DEFAULT '',
  source            text NOT NULL CHECK (source IN ('web','url','share','api')),
  url               text NULL,
  promoted_note_id  uuid NULL REFERENCES notes(id) ON DELETE SET NULL,
  discarded_at      timestamptz NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  suggestions       jsonb NULL
);

CREATE INDEX IF NOT EXISTS inbox_open_idx ON inbox_items (created_at DESC)
  WHERE discarded_at IS NULL AND promoted_note_id IS NULL;

ALTER TABLE inbox_items ADD COLUMN IF NOT EXISTS suggestions jsonb NULL;

CREATE TABLE IF NOT EXISTS attachments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id        uuid NULL REFERENCES notes(id) ON DELETE CASCADE,
  inbox_item_id  uuid NULL REFERENCES inbox_items(id) ON DELETE CASCADE,
  filename       text NOT NULL,
  mime           text NOT NULL,
  size_bytes     bigint NOT NULL CHECK (size_bytes >= 0 AND size_bytes <= 104857600),
  storage_key    text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (note_id IS NOT NULL OR inbox_item_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS ingest_jobs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        text NOT NULL,
  status      text NOT NULL,
  payload     jsonb NOT NULL DEFAULT '{}',
  error       text NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
`;

let notesSchemaReady: Promise<void> | null = null;

export async function ensureNotesSchema(databaseUrl: string): Promise<void> {
  if (!notesSchemaReady) {
    notesSchemaReady = (async () => {
      const pool = getPool(databaseUrl);
      await pool.query(NOTES_SCHEMA_SQL);
    })();
  }
  await notesSchemaReady;
}

export function resetNotesSchemaForTests(): void {
  notesSchemaReady = null;
}
