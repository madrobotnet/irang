ALTER TABLE inbox_items ADD COLUMN IF NOT EXISTS promoted_note_id uuid REFERENCES notes (id);

CREATE TABLE IF NOT EXISTS tags (
    id uuid PRIMARY KEY,
    name text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS note_tags (
    note_id uuid NOT NULL REFERENCES notes (id) ON DELETE CASCADE,
    tag_id uuid NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
    PRIMARY KEY (note_id, tag_id)
);

CREATE TABLE IF NOT EXISTS ai_jobs (
    id uuid PRIMARY KEY,
    kind text NOT NULL,
    status text NOT NULL,
    error text,
    attempts integer NOT NULL DEFAULT 0,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL
);
