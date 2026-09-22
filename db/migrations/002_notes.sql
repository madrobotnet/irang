CREATE TABLE IF NOT EXISTS notes (
    id uuid PRIMARY KEY,
    title text NOT NULL,
    body text NOT NULL,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS inbox_items (
    id uuid PRIMARY KEY,
    title text NOT NULL,
    body text NOT NULL,
    source_url text,
    created_at timestamptz NOT NULL,
    discarded_at timestamptz
);

CREATE TABLE IF NOT EXISTS attachments (
    id uuid PRIMARY KEY,
    note_id uuid REFERENCES notes (id),
    inbox_item_id uuid REFERENCES inbox_items (id),
    filename text NOT NULL,
    mime text NOT NULL,
    byte_size bigint NOT NULL,
    storage_key text NOT NULL,
    created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS judgments (
    id uuid PRIMARY KEY,
    subject_type text NOT NULL,
    subject_id uuid NOT NULL,
    kind text NOT NULL,
    value jsonb NOT NULL,
    probability double precision,
    created_at timestamptz NOT NULL
);
