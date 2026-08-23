CREATE TABLE artist_covers (
    artist_name     TEXT PRIMARY KEY,
    cover_path      TEXT,
    source          TEXT,
    is_manual       BOOLEAN NOT NULL DEFAULT false,
    attempts        INTEGER NOT NULL DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
