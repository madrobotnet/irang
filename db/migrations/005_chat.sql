CREATE TABLE IF NOT EXISTS chat_threads (
    id uuid PRIMARY KEY,
    title text NOT NULL,
    created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id uuid PRIMARY KEY,
    thread_id uuid NOT NULL REFERENCES chat_threads (id) ON DELETE CASCADE,
    role text NOT NULL,
    body text NOT NULL,
    created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_citations (
    message_id uuid NOT NULL REFERENCES chat_messages (id) ON DELETE CASCADE,
    note_id uuid NOT NULL REFERENCES notes (id),
    PRIMARY KEY (message_id, note_id)
);

CREATE TABLE IF NOT EXISTS ai_logs (
    id uuid PRIMARY KEY,
    kind text NOT NULL,
    body text NOT NULL,
    created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS note_edits (
    id uuid PRIMARY KEY,
    note_id uuid NOT NULL REFERENCES notes (id) ON DELETE CASCADE,
    proposed_body text NOT NULL,
    status text NOT NULL,
    created_at timestamptz NOT NULL
);
