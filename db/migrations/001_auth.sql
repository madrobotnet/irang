CREATE TABLE IF NOT EXISTS sessions (
    id uuid PRIMARY KEY,
    token_hash text UNIQUE NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    user_agent text,
    ip text
);

CREATE TABLE IF NOT EXISTS login_failures (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ip text NOT NULL,
    attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_failures_ip_attempted_at_idx
    ON login_failures (ip, attempted_at);

CREATE TABLE IF NOT EXISTS login_locks (
    ip text PRIMARY KEY,
    locked_until timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    at timestamptz NOT NULL DEFAULT now(),
    action text NOT NULL,
    ip text,
    meta jsonb NOT NULL DEFAULT '{}'::jsonb
);
