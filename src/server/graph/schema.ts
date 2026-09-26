import { getPool } from "../db/postgres";

const GRAPH_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS links (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_note_id  uuid NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  to_note_id    uuid NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  relation      text NOT NULL DEFAULT 'link'
                  CHECK (relation IN ('link','backlink','tag','suggested')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (from_note_id <> to_note_id),
  UNIQUE (from_note_id, to_note_id, relation)
);

CREATE INDEX IF NOT EXISTS links_from_note_idx ON links (from_note_id);
CREATE INDEX IF NOT EXISTS links_to_note_idx ON links (to_note_id);
`;

let graphSchemaReady: Promise<void> | null = null;

export async function ensureGraphSchema(databaseUrl: string): Promise<void> {
  if (!graphSchemaReady) {
    const pending = (async () => {
      const pool = getPool(databaseUrl);
      await pool.query(GRAPH_SCHEMA_SQL);
    })();
    graphSchemaReady = pending;
    try {
      await pending;
    } catch (error) {
      graphSchemaReady = null;
      throw error;
    }
  }
  await graphSchemaReady;
}

export function resetGraphSchemaForTests(): void {
  graphSchemaReady = null;
}
