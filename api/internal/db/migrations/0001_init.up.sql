-- Schema inicial: catálogo, fila (autodj+pedidos), vinhetas, configurações,
-- usuários/permissões e auditoria. Porta direta da modelagem validada em
-- produção (src/db/schema.ts), adaptada para Postgres.

CREATE TABLE songs (
    id                 BIGSERIAL PRIMARY KEY,
    title              TEXT NOT NULL,
    artist             TEXT NOT NULL,
    album              TEXT,
    path               TEXT NOT NULL UNIQUE,
    cover              TEXT NOT NULL DEFAULT '/static/images/logotipo.svg',
    time_slots         INTEGER NOT NULL DEFAULT 15, -- bitmask: 1=madrugada 2=manhã 4=tarde 8=noite
    rotation           TEXT NOT NULL DEFAULT 'normal',
    genre              TEXT NOT NULL DEFAULT 'geral',
    allowed_in_general BOOLEAN NOT NULL DEFAULT false,
    requests_count     INTEGER NOT NULL DEFAULT 0,
    likes_count        INTEGER NOT NULL DEFAULT 0,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX songs_genre_idx ON songs (genre);
CREATE INDEX songs_rotation_idx ON songs (rotation);

CREATE TABLE requests (
    id         BIGSERIAL PRIMARY KEY,
    song_id    BIGINT NOT NULL REFERENCES songs (id) ON DELETE CASCADE,
    genre      TEXT NOT NULL DEFAULT 'geral',
    "order"    INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX requests_genre_order_idx ON requests (genre, "order", created_at);

-- Timeline única por gênero: passado (played/skipped), presente (current),
-- futuro (scheduled/pending). Ciclo de vida:
--   scheduled -> pending -> current -> played
--                                    -> skipped (nunca confirmada via on_track)
CREATE TABLE queue_entries (
    id           BIGSERIAL PRIMARY KEY,
    genre        TEXT NOT NULL DEFAULT 'geral',
    song_id      BIGINT NOT NULL REFERENCES songs (id) ON DELETE CASCADE,
    status       TEXT NOT NULL, -- scheduled | pending | current | played | skipped
    source       TEXT NOT NULL DEFAULT 'autodj', -- autodj | request | admin
    request_id   BIGINT, -- snapshot; a linha em `requests` pode já ter sido apagada
    requested_at TIMESTAMPTZ,
    position     INTEGER,
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at   TIMESTAMPTZ,
    ended_at     TIMESTAMPTZ
);
CREATE INDEX queue_entries_genre_status_idx ON queue_entries (genre, status);
CREATE INDEX queue_entries_genre_position_idx ON queue_entries (genre, position);
CREATE INDEX queue_entries_genre_ended_idx ON queue_entries (genre, ended_at);
CREATE INDEX queue_entries_source_status_idx ON queue_entries (source, status);
-- Garante, no nível do banco, no máximo uma linha "current" por gênero.
CREATE UNIQUE INDEX queue_entries_one_current_idx ON queue_entries (genre) WHERE status = 'current';

CREATE TABLE jingles (
    id         BIGSERIAL PRIMARY KEY,
    title      TEXT NOT NULL,
    filename   TEXT NOT NULL,
    path       TEXT NOT NULL UNIQUE,
    duration   INTEGER,
    active     BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
INSERT INTO settings (key, value) VALUES ('jingle_interval', '5');

CREATE TABLE users (
    id            BIGSERIAL PRIMARY KEY,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'user', -- user|locutor|moderator|admin|super_admin
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE role_permissions (
    id         BIGSERIAL PRIMARY KEY,
    role       TEXT NOT NULL,
    permission TEXT NOT NULL,
    UNIQUE (role, permission)
);

-- Permissões default por papel (porta de DEFAULT_ROLE_PERMISSIONS).
INSERT INTO role_permissions (role, permission) VALUES
    ('admin', 'songs:edit_tags'), ('admin', 'songs:edit_file'), ('admin', 'songs:delete'),
    ('admin', 'requests:manage'), ('admin', 'jingles:manage'), ('admin', 'logs:view'), ('admin', 'users:manage'),
    ('super_admin', 'songs:edit_tags'), ('super_admin', 'songs:edit_file'), ('super_admin', 'songs:delete'),
    ('super_admin', 'requests:manage'), ('super_admin', 'jingles:manage'), ('super_admin', 'logs:view'), ('super_admin', 'users:manage'),
    ('moderator', 'requests:manage'), ('moderator', 'logs:view'),
    ('locutor', 'requests:manage');

CREATE TABLE admin_logs (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT,
    action      TEXT NOT NULL,
    details     JSONB,
    target_type TEXT,
    target_id   BIGINT,
    ip          TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX admin_logs_action_idx ON admin_logs (action);
