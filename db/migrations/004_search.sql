CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS search_docs (
    note_id uuid PRIMARY KEY REFERENCES notes (id) ON DELETE CASCADE,
    document tsvector NOT NULL,
    embedding vector(8),
    indexed_at timestamptz
);

CREATE INDEX IF NOT EXISTS search_docs_document_idx ON search_docs USING gin (document);
